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

    // Get user profile — we need their gender to enforce the filter
    let username = 'Unknown', gender = 'other';
    try {
      const userData = await fsFetch(`users/${uid}`, {}, token);
      const p = fromFirestoreObject(userData.fields);
      username = p.username || 'Unknown';
      gender = p.gender || 'other';
    } catch (e) {}

    // Enforce gender filter: user must match the room's filter
    if (genderFilter !== 'mixed' && gender !== genderFilter) {
      return NextResponse.json({
        error: `This queue is ${genderFilter}-only. Your profile gender (${gender}) doesn't match.`
      }, { status: 403 });
    }

    // Find an available room matching both size and gender filter
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

          // Count members
          let memberCount = 0;
          try {
            const membersData = await fsFetch(memberPath(spotId, rid), {}, token);
            memberCount = membersData.documents?.length || 0;
          } catch (e) {}

          if (memberCount >= groupSize) continue;

          // Check if we're already in this room
          try {
            await fsFetch(memberPath(spotId, rid, uid), {}, token);
            return NextResponse.json({ status: 'waiting', roomId: rid });
          } catch (e) {}

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
