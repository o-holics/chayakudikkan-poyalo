import { NextResponse } from 'next/server';
import { fsFetch, fromFirestoreObject } from '@/lib/firebase';
import { getSessionToken, getJwtPayload } from '@/lib/auth';
import {
  roomPath, memberPath, triggerMatch, evaluateTimer,
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
      const groupData = await fsFetch(`groups/${user.currentGroupId}`, {}, token);
      const group = fromFirestoreObject(groupData.fields);
      return NextResponse.json({ status: 'matched', group });
    }

    if (user.status === 'waiting' && user.currentRoomId && user.currentSpotId) {
      const { currentRoomId: roomId, currentSpotId: spotId } = user;

      // Fetch room metadata
      const roomData = await fsFetch(roomPath(spotId, roomId), {}, token);
      const room = { id: roomId, ...fromFirestoreObject(roomData.fields) } as QueueRoom;

      // If room was already matched (race condition), re-check user status
      if (room.status === 'matched') {
        // Poll again — user's profile update may be slightly behind
        return NextResponse.json({ status: 'waiting', current: 0, required: room.groupSize, members: [], matchAt: null, timerStartedAt: null });
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
        const { groupId, secretWord } = await triggerMatch(spotId, roomId, membersToMatch, token);
        // The user's own status is updated inside triggerMatch — return matched immediately
        return NextResponse.json({ status: 'matched', group: { secretWord, userDetails: membersToMatch } });
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
        members: allMembers.map(m => ({ username: m.username, gender: m.gender }))
      });
    }

    return NextResponse.json({ status: user.status || 'idle' });
  } catch (error: any) {
    console.error('Queue status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
