import { v4 as uuidv4 } from "uuid";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { sendResponse } from "../../services/response.js";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";



//example på objektet som förväntas av frontend
// {
//   "guestName": "Jesper",
//   "guestEmail": "Jesper@example.com",
//   "checkInDate": "2025-10-21",
//   "checkOutDate": "2025-10-23",
//   "guests": 7,
//   "rooms": [
//     { "roomId": 1, "count": 2 },    // Single room
//     { "roomId": 2, "count": 1 },    // Double room
//     { "roomId": 3, "count": 1 }    // Suite room
//   ]
// }



// Skapa klienter för DynamoDB
const client = new DynamoDBClient({ region: "eu-north-1" });
const docClient = DynamoDBDocumentClient.from(client);

// Tabellnamn i DynamoDB
const BONZAI_TABLE = "bonzai";

// Funktion som beräknar antal nätter mellan in- och utcheckningsdatum
function nightsBetween(checkIn, checkOut) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = Date.parse(checkIn);
  const end = Date.parse(checkOut);
  return Math.round((end - start) / msPerDay);
}


 // Skapar en bokning och uppdaterar rumstillgänglighet
 
export const handler = async (event) => {
  try {

    // Hämta data från request
    const body = JSON.parse(event.body);

    // tar ut boknings uppgifter från body
    const { guestName, guestEmail, checkInDate, checkOutDate, guests, rooms } = body;

    // Validering av obligatoriska fält
    if (!guestName || !guestEmail || !checkInDate || !checkOutDate || !guests || !rooms) {
      return sendResponse(400, { message: "Missing required fields" });
    }

    // Beräkna antal nätter
    const nights = nightsBetween(checkInDate, checkOutDate);
    if (nights <= 0) return sendResponse(400, { message: "Invalid dates" });

    const transactItems = []; // Sparar alla operationer som ska köras atomiskt

    let totalCapacity = 0;   // Total kapacitet för alla bokade rum

    let totalPrice = 0;      // Totalpris för bokningen

    // Loop genom varje rum som användaren vill boka
    for (const room of rooms) {
      const roomTypeId = room.roomId;     // t.ex. 1 = single , 2 = double , 3 = suite
      const numberOfRooms = room.count; // antal rum av denna typ

      // Hämta rummet från DynamoDB
      const roomItem = await docClient.send(
        new GetCommand({
          TableName: "bonzai",
          Key: { pk: "ROOM", sk: `ROOMID#${roomTypeId}` },
        })
      );

      // Kontrollera att rummet finns
      if (!roomItem.Item) {
        return sendResponse(400, { message: `Room type ${roomTypeId} does not exist` });
      }

      // Kontrollera tillgänglighet
      if (roomItem.Item.available < numberOfRooms) {
        return sendResponse(400, { message: `Not enough available rooms for type ${roomTypeId}` });
      }

      // Summera kapacitet och pris
      totalCapacity += roomItem.Item.roomCapacity * numberOfRooms;
      totalPrice += roomItem.Item.price * numberOfRooms * nights;

      // Lägg till uppdatering av tillgänglighet i transaktionen
      transactItems.push({
        Update: {
          TableName: "bonzai",
          Key: { pk: "ROOM", sk: `ROOMID#${roomTypeId}` },
          UpdateExpression: "SET available = available - :numberOfRooms",
          ExpressionAttributeValues: { ":numberOfRooms": numberOfRooms },
        },
      });
    }

    // Kontrollera att rummen kan rymma alla gäster (efter loopen)
    if (totalCapacity < guests) {
      return sendResponse(400, { message: "Rooms do not match number of guests" });
    }

    // Skapa unikt boknings-ID
    const bookingId = uuidv4();

    // Skapa bokningsobjekt
    const bookingItem = {
      pk: `GUEST#${guestEmail}`,   // Partition key
      sk: `BOOKING#${bookingId}`,  // Sort key
      bookingId,
      guestName,
      guestEmail,
      checkInDate,
      checkOutDate,
      guests,
      rooms: JSON.stringify(rooms),
      totalPrice,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
    };

    // Lägg till bokning i transaktionen
    transactItems.push({
      Put: {
        TableName: BONZAI_TABLE,
        Item: bookingItem,
      },
    });

    // Kör hela transaktionen atomiskt
    await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

    // Returnera svar
    return sendResponse(201, {
      ...body,
      bookingId,
      totalPrice,
      status: "CONFIRMED",
      createdAt: bookingItem.createdAt,
    });

  } catch (err) {
    console.error(err);
    return sendResponse(500, { message: "Internal server error" });
  }
};
