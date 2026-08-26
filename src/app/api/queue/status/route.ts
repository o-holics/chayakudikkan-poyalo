import { NextResponse } from 'next/server';
import { fsFetch, toFirestoreObject, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';
import {
  roomPath, memberPath, triggerMatch, evaluateTimer, updateSpotCounters,
  type QueueRoom, type QueueMember
} from '@/lib/queue';

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = getJwtPayload(token);
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const uid = payload.sub;

  try {
    // Get user profile
    const userData = await fsFetch(`users/${uid}`, {}, token);
    const user = fromFirestoreObject(userData.fields);

    if (user.status === 'matched' && user.currentGroupId) {
      try {
        const groupData = await fsFetch(`groups/${user.currentGroupId}`, {}, token);
        const group = fromFirestoreObject(groupData.fields);

        // Check if 1 hour has elapsed
        const now = Date.now();
        const expiresAtTime = group.expiresAt
          ? new Date(group.expiresAt).getTime()
          : (group.createdAt ? new Date(group.createdAt).getTime() + 60 * 60 * 1000 : 0);

        if (expiresAtTime > 0 && now >= expiresAtTime) {
          // 1 hour window expired! Automatically disband group and reset user state to idle
          await fsFetch(`groups/${user.currentGroupId}?updateMask.fieldPaths=status`, {
            method: 'PATCH',
            body: JSON.stringify({ fields: toFirestoreObject({ status: 'completed' }) })
          }, token).catch(() => {});

          if (group.spotId) {
            await updateSpotCounters(group.spotId, 0, -1, token);
          }

          await fsFetch(`users/${uid}?updateMask.fieldPaths=status&updateMask.fieldPaths=currentGroupId&updateMask.fieldPaths=currentRoomId&updateMask.fieldPaths=currentSpotId`, {
            method: 'PATCH',
            body: JSON.stringify({
              fields: toFirestoreObject({ status: 'idle', currentGroupId: null, currentRoomId: null, currentSpotId: null })
            })
          }, token).catch(() => {});

          return NextResponse.json({ status: 'idle', disbanded: true, reason: 'Meetup expired after 1 hour' });
        }

        return NextResponse.json({
          status: 'matched',
          group,
          expiresAt: group.expiresAt || new Date(expiresAtTime).toISOString()
        });
      } catch (e) {
        return NextResponse.json({ status: 'idle' });
      }
    }

    if (user.status === 'waiting' && user.currentRoomId && user.currentSpotId) {
      const { currentRoomId: roomId, currentSpotId: spotId } = user;

      // Fetch room metadata
      const roomData = await fsFetch(roomPath(spotId, roomId), {}, token);
      const room = { id: roomId, ...fromFirestoreObject(roomData.fields) } as QueueRoom;

      // If room was already matched, fetch and return the matched group immediately
      if (room.status === 'matched') {
        const groupId = (room as any).matchedGroupId || `group_${spotId}_${roomId}`;
        try {
          const groupData = await fsFetch(`groups/${groupId}`, {}, token);
          if (groupData?.fields) {
            const group = fromFirestoreObject(groupData.fields);
            return NextResponse.json({
              status: 'matched',
              group,
              expiresAt: group.expiresAt
            });
          }
        } catch (e) {}
      }

      // Fetch all members
      let allMembers: QueueMember[] = [];
      try {
        const membersData = await fsFetch(memberPath(spotId, roomId), {}, token);
        if (membersData.documents) {
          allMembers = membersData.documents.map((doc: any) => ({
            uid: doc.name.split('/').pop(),
            ...fromFirestoreObject(doc.fields)
          }));
        }
      } catch (e) {}

      const memberCount = allMembers.length;

      // Evaluate and potentially update timer
      const { timerStartedAt, matchAt, shouldMatch } = await evaluateTimer(
        spotId, room, memberCount, token
      );

      if (shouldMatch) {
        const membersToMatch = allMembers.slice(0, room.groupSize);
        const { groupId, secretWord, group } = await triggerMatch(spotId, roomId, membersToMatch, token);
        return NextResponse.json({
          status: 'matched',
          group: group || { secretWord, userDetails: membersToMatch },
          expiresAt: (group as any)?.expiresAt
        });
      }

      return NextResponse.json({
        status: 'waiting',
        current: memberCount,
        required: room.groupSize,
        genderFilter: room.genderFilter || 'mixed',
        spotId,
        roomId,
        timerStartedAt,
        matchAt,
        members: allMembers.map(m => ({ uid: m.uid, username: m.username, gender: m.gender }))
      });
    }

    return NextResponse.json({ status: user.status || 'idle' });
  } catch (error: any) {
    console.error('Queue status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
