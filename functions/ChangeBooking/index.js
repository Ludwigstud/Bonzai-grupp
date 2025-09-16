import { client } from "../../services/db.js";
import { 
  GetItemCommand,
  QueryCommand,
  PutItemCommand,
  DeleteItemCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { sendResponse } from "../../services/response.js";

const BOOKINGS_TABLE = "bonzai";

// example på PUT request : (bookingId skall skickas med url)
// {
//     "startDate": "2025-12-26",
//     "endDate": "2025-12-28",
//     "rooms":[
//         {
//             "roomType": 1,
//             "people": 1
//         },
//         {
//             "roomType": 3,
//             "people": 3
//         },
//         {
//             "roomType": 2,
//             "people": 2
//         }
        
//     ]
// }

export const handler = async (event) => {
  try {
    const { id } = event.pathParameters;
    if (!id) return sendResponse(400, { message: "Missing BookingId" });

    const body = JSON.parse(event.body);
    if (!body || !body.rooms || !Array.isArray(body.rooms)) {
      return sendResponse(400, { message: "Invalid request body, must include rooms array" });
    }

    
    const totalResult = await client.send(new GetItemCommand({
      TableName: BOOKINGS_TABLE,
      Key: { pk: { S: `BOOKING#${id}` }, sk: { S: "TOTAL" } }
    }));
    if (!totalResult.Item) return sendResponse(404, { message: "Booking not found" });

    const userName = body.name || totalResult.Item.name.S;
    const userEmail = body.email || totalResult.Item.email.S;

    
    const queryResult = await client.send(new QueryCommand({
      TableName: BOOKINGS_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": { S: "BOOKING" },
        ":skPrefix": { S: `ROOM#${id}` }
      }
    }));

    const existingRooms = queryResult.Items ;

   
    const oldCountPerType = {};
    existingRooms.forEach(r => {
      const type = Number(r.roomType.N);
      oldCountPerType[type] = (oldCountPerType[type] || 0) + 1;
    });

    const newCountPerType = {};
    body.rooms.forEach(r => {
      const type = r.roomType;
      newCountPerType[type] = (newCountPerType[type] || 0) + 1;
    });

    const allRoomTypes = Array.from(new Set([...Object.keys(oldCountPerType), ...Object.keys(newCountPerType)]));
    await Promise.all(allRoomTypes.map(async (typeStr) => {
      const type = Number(typeStr);
      const oldCount = oldCountPerType[type] || 0;
      const newCount = newCountPerType[type] || 0;
      const diff = newCount - oldCount; 

      const room = await client.send(new GetItemCommand({
        TableName: BOOKINGS_TABLE,
        Key: { pk: { S: "ROOM" }, sk: { S: `ROOMID#${type}` } }
      }));

      if (room.Item) {
        const available = Number(room.Item.available.N) - diff;
        await client.send(new PutItemCommand({
          TableName: BOOKINGS_TABLE,
          Item: {
            pk: room.Item.pk,
            sk: room.Item.sk,
            roomType: room.Item.roomType,
            cost: room.Item.cost,
            available: { N: String(available) }
          }
        }));
      }
    }));

   
    let totalGuests = 0;
    let totalCost = 0;
    const COST_PER_ROOMTYPE = { 1: 500, 2: 1000, 3: 1500 }; 

    body.rooms.forEach(r => {
      totalGuests += r.people;
      totalCost += COST_PER_ROOMTYPE[r.roomType] || 0;
    });

    
    await client.send(new UpdateItemCommand({
      TableName: BOOKINGS_TABLE,
      Key: { pk: { S: `BOOKING#${id}` }, sk: { S: "TOTAL" } },
      UpdateExpression: "SET #startDate = :startDate, #endDate = :endDate, #totalRooms = :totalRooms, #totalGuests = :totalGuests, #cost = :cost, #name = :name, #email = :email",
      ExpressionAttributeNames: {
        "#startDate": "startDate",
        "#endDate": "endDate",
        "#totalRooms": "totalRooms",
        "#totalGuests": "totalGuests",
        "#cost": "cost",
        "#name": "name",
        "#email": "email"
      },
      ExpressionAttributeValues: {
        ":startDate": { S: body.startDate },
        ":endDate": { S: body.endDate },
        ":totalRooms": { N: String(body.rooms.length) },
        ":totalGuests": { N: String(totalGuests) },
        ":cost": { N: String(totalCost) },
        ":name": { S: userName },
        ":email": { S: userEmail }
      }
    }));

    
    const maxLength = Math.max(existingRooms.length, body.rooms.length);

    for (let i = 0; i < maxLength; i++) {
      const newRoom = body.rooms[i];
      const existingRoom = existingRooms[i];

      if (newRoom && existingRoom) {
        
        await client.send(new UpdateItemCommand({
          TableName: BOOKINGS_TABLE,
          Key: { pk: { S: existingRoom.pk.S }, sk: { S: existingRoom.sk.S } },
          UpdateExpression: "SET #startDate = :startDate, #endDate = :endDate, #people = :people, #roomType = :roomType, #cost = :cost, #name = :name, #email = :email",
          ExpressionAttributeNames: {
            "#startDate": "startDate",
            "#endDate": "endDate",
            "#people": "people",
            "#roomType": "roomType",
            "#cost": "cost",
            "#name": "name",
            "#email": "email"
          },
          ExpressionAttributeValues: {
            ":startDate": { S: body.startDate },
            ":endDate": { S: body.endDate },
            ":people": { N: String(newRoom.people) },
            ":roomType": { N: String(newRoom.roomType) },
            ":cost": { N: String(COST_PER_ROOMTYPE[newRoom.roomType] || 0) },
            ":name": { S: userName },
            ":email": { S: userEmail }
          }
        }));
      } else if (newRoom && !existingRoom) {
        
        const newSk = `ROOM#${id}#${userName}#${i + 1}`;
        await client.send(new PutItemCommand({
          TableName: BOOKINGS_TABLE,
          Item: {
            pk: { S: "BOOKING" },
            sk: { S: newSk },
            roomType: { N: String(newRoom.roomType) },
            people: { N: String(newRoom.people) },
            startDate: { S: body.startDate },
            endDate: { S: body.endDate },
            cost: { N: String(COST_PER_ROOMTYPE[newRoom.roomType] || 0) },
            name: { S: userName },
            email: { S: userEmail }
          }
        }));
      } else if (!newRoom && existingRoom) {
        
        await client.send(new DeleteItemCommand({
          TableName: BOOKINGS_TABLE,
          Key: { pk: { S: existingRoom.pk.S }, sk: { S: existingRoom.sk.S } }
        }));
      }
    }

    return sendResponse(200, { message: "Booking and rooms updated successfully" });

  } catch (err) {
    console.error(err);
    return sendResponse(500, { message: "Could not update booking.", error: err.message });
  }
};
