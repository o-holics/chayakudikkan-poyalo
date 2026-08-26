import { fsFetch, toFirestoreObject } from '@/lib/firebase';

const SECRET_WORDS = [
  'Blue Pineapple', 'Golden Fox', 'Silver Eagle', 'Crimson Tide',
  'Emerald Forest', 'Ruby Slippers', 'Neon Horizon', 'Cosmic Dust',
  'Velvet Thunder', 'Sapphire Wolf', 'Amber Falcon', 'Jade Serpent',
  'Iron Phoenix', 'Coral Tiger', 'Obsidian Bear', 'Topaz Raven',
  'Frozen Tide', 'Shadow Bloom', 'Crystal Mist', 'Neon Panda'
];

export const TIMER_DURATION_MS = 3 * 60 * 1000; // 3 minutes
export const TIMER_MIN_MEMBERS = 5; // Minimum for timer to start/continue
export const LARGE_GROUP_SIZES = [8, 10]; // Sizes with timer logic

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
 * Returns the Firestore path for the members subcollection of a room.
 */
export function memberPath(spotId: string, roomId: string, uid?: string) {
  const base = `spots/${spotId}/queueRooms/${roomId}/members`;
  return uid ? `${base}/${uid}` : base;
}

/**
 * Triggers a group match for the given room and members.
 * Creates the group document and updates all user statuses.
 */
export async function triggerMatch(
  spotId: string,
  roomId: string,
  members: QueueMember[],
  token: string
) {
  const secretWord = SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)];
  const groupId = `group-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  // Create the group document
  await fsFetch(`groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: toFirestoreObject({
        spotId,
        roomId,
        groupSize: members.length,
        users: members.map(m => m.uid),
        userDetails: members.map(m => ({ uid: m.uid, username: m.username, gender: m.gender })),
        secretWord,
        status: 'active',
        createdAt: new Date().toISOString()
      })
    })
  }, token);

  // Mark room as matched
  await fsFetch(`${roomPath(spotId, roomId)}?updateMask.fieldPaths=status`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFirestoreObject({ status: 'matched' }) })
  }, token).catch(() => {});

  // Update all matched users' status
  await Promise.all(members.map(m =>
    fsFetch(`users/${m.uid}?updateMask.fieldPaths=status&updateMask.fieldPaths=currentGroupId&updateMask.fieldPaths=currentRoomId&updateMask.fieldPaths=currentSpotId`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject({ status: 'matched', currentGroupId: groupId, currentRoomId: null, currentSpotId: null })
      })
    }, token).catch(() => {})
  ));

  return { groupId, secretWord };
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
