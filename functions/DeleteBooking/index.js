import { client } from "../../services/db.js";
import { GetItemCommand, ScanCommand, DeleteItemCommand, PutItemCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { sendResponse } from "../../services/response.js";

const BOOKINGS_TABLE = "bonzai";
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const handler = async (event) => {
  try {
    const { id } = event.pathParameters;
    if (!id) return sendResponse(400, { message: "Missing bookingId" });

    // Hämta TOTAL-rad
    const totalResult = await client.send(new GetItemCommand({
      TableName: BOOKINGS_TABLE,
      Key: { pk: { S: `BOOKING#${id}` }, sk: { S: "TOTAL" } }
    }));

    if (!totalResult.Item) return sendResponse(404, { message: "Booking not found" });

    const checkInDate = new Date(totalResult.Item.startDate.S);
    const diffDays = Math.ceil((checkInDate - new Date()) / MS_PER_DAY);
    if (diffDays < 2) return sendResponse(400, { message: "Booking cannot be canceled less than 2 days before check-in" });

    // Hämta alla rumsbokningar med Scan + begins_with
    const scanResult = await client.send(new ScanCommand({
      TableName: BOOKINGS_TABLE,
      FilterExpression: "begins_with(sk, :skPrefix)",
      ExpressionAttributeValues: { ":skPrefix": { S: `ROOM#${id}` } }
    }));

    const bookingRooms = scanResult.Items || [];

    // Uppdatera tillgänglighet
    await Promise.all(bookingRooms.map(async roomItem => {
      const roomType = Number(roomItem.roomType.N);
      const room = await client.send(new GetItemCommand({
        TableName: BOOKINGS_TABLE,
        Key: { pk: { S: "ROOM" }, sk: { S: `ROOMID#${roomType}` } }
      }));
      if (room.Item) {
        const available = Number(room.Item.available.N) + 1;
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

    // Ta bort TOTAL + rumsbokningar med BatchWrite
    const deleteRequests = [
      { DeleteRequest: { Key: { pk: { S: `BOOKING#${id}` }, sk: { S: "TOTAL" } } } },
      ...bookingRooms.map(item => ({ DeleteRequest: { Key: { pk: item.pk, sk: item.sk } } }))
    ];

    // DynamoDB BatchWrite max 25 items per request
    const batches = [];
    while (deleteRequests.length) batches.push(deleteRequests.splice(0, 25));

    for (const batch of batches) {
      await client.send(new BatchWriteItemCommand({ RequestItems: { [BOOKINGS_TABLE]: batch } }));
    }

    return sendResponse(200, { message: "Booking canceled successfully" });

  } catch (err) {
    console.error(err);
    return sendResponse(500, { message: "Could not cancel booking.", error: err.message });
  }
};
