import { NextResponse } from 'next/server';
import { fsFetch, toFirestoreObject, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';
import {
  roomPath, memberPath, triggerMatch, evaluateTimer,
  type QueueRoom, type QueueMember
} from '@/lib/queue';

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    const { spotId, groupSize, genderFilter } = await request.json();

    if (!spotId) return NextResponse.json({ error: 'Spot ID required' }, { status: 400 });
    if (![2, 5, 8, 10].includes(groupSize)) return NextResponse.json({ error: 'Invalid group size' }, { status: 400 });
    if (!['mixed', 'male', 'female', 'other'].includes(genderFilter)) {
      return NextResponse.json({ error: 'Invalid gender filter' }, { status: 400 });
    }

    // Get user profile — check for any existing active queue or meetup
    let username = 'Unknown', gender = 'other';
    let userProfile: any = null;
    try {
      const userData = await fsFetch(`users/${uid}`, {}, token);
      userProfile = fromFirestoreObject(userData.fields);
      username = userProfile.username || 'Unknown';
      gender = userProfile.gender || 'other';
    } catch (e) {}

    // Guard: Prevent joining a new queue if user is in an active meetup
    if (userProfile?.status === 'matched' && userProfile?.currentGroupId) {
      try {
        const groupData = await fsFetch(`groups/${userProfile.currentGroupId}`, {}, token);
        const group = fromFirestoreObject(groupData.fields);
        const now = Date.now();
        const expiresAt = group.expiresAt ? new Date(group.expiresAt).getTime() : 0;
        if (expiresAt > now && group.status === 'active') {
          return NextResponse.json({
            error: 'You are currently in an active meetup. Please end your current meetup before joining a new queue.'
          }, { status: 400 });
        }
      } catch (e) {}
    }

    // Guard: Prevent joining if user is already waiting in a queue at a different spot
    if (userProfile?.status === 'waiting' && userProfile?.currentRoomId && userProfile?.currentSpotId) {
      if (userProfile.currentSpotId !== spotId) {
        return NextResponse.json({
          error: 'You are already waiting in a queue at another spot. Please leave your current queue first.'
        }, { status: 400 });
      }
    }

    // Enforce gender filter: user must match the room's filter
    if (genderFilter !== 'mixed' && gender !== genderFilter) {
      return NextResponse.json({
        error: `This queue is ${genderFilter}-only. Your profile gender (${gender}) doesn't match.`
      }, { status: 403 });
    }

    // Fetch current user's blocked UIDs
    const userBlockedUids = new Set<string>();
    try {
      const blocksData = await fsFetch(`users/${uid}/blocks`, {}, token);
      if (blocksData.documents) {
        for (const doc of blocksData.documents) {
          const bUid = doc.name.split('/').pop();
          if (bUid) userBlockedUids.add(bUid);
        }
      }
    } catch (e) {}

    // Find an available room matching size, gender filter, and block compatibility
    let targetRoomId: string | null = null;
    let targetRoom: QueueRoom | null = null;

    try {
      const roomsData = await fsFetch(`spots/${spotId}/queueRooms`, {}, token);
      if (roomsData.documents) {
        for (const doc of roomsData.documents) {
          const rid = doc.name.split('/').pop();
          const r = fromFirestoreObject(doc.fields) as QueueRoom;
          r.id = rid;

          // Must match status, size AND gender filter
          if (r.status !== 'waiting') continue;
          if (r.groupSize !== groupSize) continue;
          if ((r.genderFilter || 'mixed') !== genderFilter) continue;

          // Fetch member IDs in this candidate room
          let memberUids: string[] = [];
          try {
            const membersData = await fsFetch(memberPath(spotId, rid), {}, token);
            if (membersData.documents) {
              memberUids = membersData.documents.map((d: any) => d.name.split('/').pop());
            }
          } catch (e) {}

          // Check if room is full
          if (memberUids.length >= groupSize) continue;

          // Check if we're already in this room
          if (memberUids.includes(uid)) {
            return NextResponse.json({ status: 'waiting', roomId: rid });
          }

          // 1. Outgoing check: Check if ANY current room member is in our blocked list
          const hasBlockedSomeoneInRoom = memberUids.some(mUid => userBlockedUids.has(mUid));
          if (hasBlockedSomeoneInRoom) continue; // Skip room!

          // 2. Incoming check: Concurrently check if ANY member in the room has blocked us
          const blockChecks = await Promise.all(
            memberUids.map(async (mUid) => {
              try {
                const bDoc = await fsFetch(`users/${mUid}/blocks/${uid}`, {}, token);
                return !!bDoc?.fields;
              } catch (e) {
                return false;
              }
            })
          );

          const isBlockedByAnyMember = blockChecks.some(blocked => blocked === true);
          if (isBlockedByAnyMember) continue; // Skip room!

          targetRoomId = rid;
          targetRoom = r;
          break;
        }
      }
    } catch (e) {}

    // Create a new room if none found
    if (!targetRoomId) {
      targetRoomId = `room-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
      targetRoom = {
        id: targetRoomId,
        spotId,
        groupSize,
        genderFilter: genderFilter as QueueRoom['genderFilter'],
        status: 'waiting',
        createdAt: new Date().toISOString(),
        timerStartedAt: null,
        matchAt: null
      };

      await fsFetch(roomPath(spotId, targetRoomId), {
        method: 'PATCH',
        body: JSON.stringify({
          fields: toFirestoreObject({
            spotId,
            groupSize,
            genderFilter,
            status: 'waiting',
            createdAt: targetRoom.createdAt,
            timerStartedAt: null,
            matchAt: null
          })
        })
      }, token);
    }

    // Add ourselves to the room
    await fsFetch(memberPath(spotId, targetRoomId, uid), {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject({ username, gender, joinedAt: new Date().toISOString() })
      })
    }, token);

    // Update user status
    await fsFetch(`users/${uid}?updateMask.fieldPaths=status&updateMask.fieldPaths=currentRoomId&updateMask.fieldPaths=currentSpotId`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: toFirestoreObject({ status: 'waiting', currentRoomId: targetRoomId, currentSpotId: spotId })
      })
    }, token);

    // Fetch actual members now
    let allMembers: QueueMember[] = [];
    try {
      const membersData = await fsFetch(memberPath(spotId, targetRoomId), {}, token);
      if (membersData.documents) {
        allMembers = membersData.documents.map((doc: any) => ({
          uid: doc.name.split('/').pop(),
          ...fromFirestoreObject(doc.fields)
        }));
      }
    } catch (e) {}

    const memberCount = allMembers.length;

    const { timerStartedAt, matchAt, shouldMatch } = await evaluateTimer(
      spotId, targetRoom!, memberCount, token
    );

    if (shouldMatch) {
      const membersToMatch = allMembers.slice(0, groupSize);
      const { groupId, secretWord } = await triggerMatch(spotId, targetRoomId, membersToMatch, token);
      return NextResponse.json({ status: 'matched', groupId, secretWord });
    }

    return NextResponse.json({
      status: 'waiting',
      roomId: targetRoomId,
      current: memberCount,
      required: groupSize,
      genderFilter,
      timerStartedAt,
      matchAt,
      members: allMembers.map(m => ({ username: m.username, gender: m.gender }))
    });

  } catch (error: any) {
    console.error('Queue join error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
