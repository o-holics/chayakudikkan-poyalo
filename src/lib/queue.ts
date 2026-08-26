import { fsFetch, toFirestoreObject } from '@/lib/firebase';

const SECRET_WORDS = [
  'Blue Pineapple', 'Golden Fox', 'Silver Eagle', 'Crimson Tide',
  'Emerald Forest', 'Ruby Slippers', 'Neon Horizon', 'Cosmic Dust',
  'Velvet Thunder', 'Sapphire Wolf', 'Amber Falcon', 'Jade Serpent',
  'Iron Phoenix', 'Coral Tiger', 'Obsidian Bear', 'Topaz Raven',
  'Frozen Tide', 'Shadow Bloom', 'Crystal Mist', 'Neon Panda'
];

export const MEETUP_DURATION_MS = 60 * 60 * 1000; // 1 hour

export const TIMER_DURATION_MS = 90 * 1000; // 1 minute 30 seconds
export const TIMER_MIN_MEMBERS = 3; // Minimum for timer to start/continue for size 6
export const LARGE_GROUP_SIZES = [6]; // Timer only applies to size 6

export type QueueRoom = {
  id: string;
  spotId: string;
  groupSize: number;
  genderFilter: 'mixed' | 'male' | 'female' | 'other';
  status: 'waiting' | 'matched';
  createdAt: string;
  timerStartedAt: string | null;
  matchAt: string | null;
};

export type QueueMember = {
  uid: string;
  username: string;
  gender: string;
  joinedAt: string;
};

/**
 * Returns the Firestore path for a queue room.
 */
export function roomPath(spotId: string, roomId: string) {
  return `spots/${spotId}/queueRooms/${roomId}`;
}

/**
 * Updates waitingCount, matchedCount, and activeCount directly on the spot document.
 */
export async function updateSpotCounters(
  spotId: string,
  deltaWaiting: number,
  deltaMatched: number,
  token: string
) {
  if (!spotId) return;
  try {
    const spotData = await fsFetch(`spots/${spotId}`, {}, token);
    const spot = spotData.fields ? (await import('@/lib/firebase')).fromFirestoreObject(spotData.fields) : {};
    const waitingCount = Math.max(0, (spot.waitingCount || 0) + deltaWaiting);
    const matchedCount = Math.max(0, (spot.matchedCount || 0) + deltaMatched);
    const activeCount = waitingCount + matchedCount;

    await fsFetch(
      `spots/${spotId}?updateMask.fieldPaths=waitingCount&updateMask.fieldPaths=matchedCount&updateMask.fieldPaths=activeCount`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: toFirestoreObject({ waitingCount, matchedCount, activeCount })
        })
      },
      token
    ).catch(() => {});
  } catch (e) {
    console.warn(`Could not update counters on spot ${spotId}:`, e);
  }
}

/**
 * Returns the Firestore path for the members subcollection of a room.
 */
export function memberPath(spotId: string, roomId: string, uid?: string) {
  const base = `spots/${spotId}/queueRooms/${roomId}/members`;
  return uid ? `${base}/${uid}` : base;
}

/**
 * Triggers a group match for the given room and members.
 * Creates the group document and updates all user statuses idempotently.
 */
export async function triggerMatch(
  spotId: string,
  roomId: string,
  members: QueueMember[],
  token: string
) {
  const groupId = `group_${spotId}_${roomId}`;

  // Check if room or group was already created by a concurrent request
  try {
    const existingGroupData = await fsFetch(`groups/${groupId}`, {}, token);
    if (existingGroupData?.fields) {
      const eg = (await import('@/lib/firebase')).fromFirestoreObject(existingGroupData.fields);
      if (eg?.secretWord) {
        return { groupId, secretWord: eg.secretWord, group: eg };
      }
    }
  } catch (e) {}

  const secretWord = SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)];
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + MEETUP_DURATION_MS).toISOString();

  const groupPayload = {
    spotId,
    roomId,
    groupSize: members.length,
    users: members.map(m => m.uid),
    userDetails: members.map(m => ({ uid: m.uid, username: m.username, gender: m.gender })),
    secretWord,
    status: 'active',
    createdAt,
    expiresAt,
  };

  // 1. Create the group document (single deterministic document ID)
  await fsFetch(`groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: toFirestoreObject(groupPayload)
    })
  }, token);

  // 2. Mark room as matched and record matchedGroupId
  await fsFetch(`${roomPath(spotId, roomId)}?updateMask.fieldPaths=status&updateMask.fieldPaths=matchedGroupId`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFirestoreObject({ status: 'matched', matchedGroupId: groupId }) })
  }, token).catch(() => {});

  // Fetch spot details for history description
  let spotName = 'Meetup Spot';
  try {
    const spotData = await fsFetch(`spots/${spotId}`, {}, token);
    const sf = spotData.fields ? (await import('@/lib/firebase')).fromFirestoreObject(spotData.fields) : null;
    if (sf?.name) spotName = sf.name;
  } catch (e) {}

  // 3. Record meetup history for each participant (using deterministic groupId as doc key)
  const historyRecord = {
    groupId,
    spotId,
    spotName,
    secretWord,
    groupSize: members.length,
    matchedAt: createdAt,
    members: members.map(m => ({ uid: m.uid, username: m.username, gender: m.gender }))
  };

  await Promise.all(members.map(m =>
    fsFetch(`users/${m.uid}/meetupHistory/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject(historyRecord)
      })
    }, token).catch(() => {})
  ));

  // 4. Update all matched users' status immediately
  await Promise.all(members.map(m =>
    fsFetch(`users/${m.uid}?updateMask.fieldPaths=status&updateMask.fieldPaths=currentGroupId&updateMask.fieldPaths=currentRoomId&updateMask.fieldPaths=currentSpotId`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject({ status: 'matched', currentGroupId: groupId, currentRoomId: null, currentSpotId: null })
      })
    }, token).catch(() => {})
  ));

  // 5. Update spot counters: shift members from waiting to matched
  await updateSpotCounters(spotId, -members.length, +members.length, token);

  return { groupId, secretWord, group: groupPayload };
}

/**
 * Evaluates timer state and potentially updates the room document.
 * Returns updated timerStartedAt and matchAt values.
 */
export async function evaluateTimer(
  spotId: string,
  room: QueueRoom,
  memberCount: number,
  token: string
): Promise<{ timerStartedAt: string | null; matchAt: string | null; shouldMatch: boolean }> {
  const isLargeGroup = LARGE_GROUP_SIZES.includes(room.groupSize);

  if (!isLargeGroup) {
    return { timerStartedAt: null, matchAt: null, shouldMatch: memberCount >= room.groupSize };
  }

  // Check full match regardless of timer
  if (memberCount >= room.groupSize) {
    return { timerStartedAt: room.timerStartedAt, matchAt: room.matchAt, shouldMatch: true };
  }

  const now = Date.now();

  if (memberCount < TIMER_MIN_MEMBERS) {
    // Need to reset timer if it was running
    if (room.timerStartedAt) {
      await fsFetch(`${roomPath(spotId, room.id)}?updateMask.fieldPaths=timerStartedAt&updateMask.fieldPaths=matchAt`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: toFirestoreObject({ timerStartedAt: null, matchAt: null }) })
      }, token).catch(() => {});
    }
    return { timerStartedAt: null, matchAt: null, shouldMatch: false };
  }

  // memberCount >= TIMER_MIN_MEMBERS
  if (!room.timerStartedAt) {
    // Start the timer
    const timerStartedAt = new Date().toISOString();
    const matchAt = new Date(now + TIMER_DURATION_MS).toISOString();
    await fsFetch(`${roomPath(spotId, room.id)}?updateMask.fieldPaths=timerStartedAt&updateMask.fieldPaths=matchAt`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: toFirestoreObject({ timerStartedAt, matchAt }) })
    }, token).catch(() => {});
    return { timerStartedAt, matchAt, shouldMatch: false };
  }

  // Timer is running — check if expired
  const matchAt = room.matchAt ? new Date(room.matchAt).getTime() : Infinity;
  if (now >= matchAt) {
    return { timerStartedAt: room.timerStartedAt, matchAt: room.matchAt, shouldMatch: true };
  }

  return { timerStartedAt: room.timerStartedAt, matchAt: room.matchAt, shouldMatch: false };
}
