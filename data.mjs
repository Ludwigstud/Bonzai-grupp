import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "eu-north-1" }); // Anpassa region
const docClient = DynamoDBDocumentClient.from(client);

const seedDatabase = async () => {
	const itemsToPut = [
		{ pk: "ROOM", sk: "ROOMID#1", roomType : "Single",      price: 500,  available: 7, roomCapacity: 1  },
		{ pk: "ROOM", sk: "ROOMID#2", roomType : "Double room", price: 1000, available: 7, roomCapacity: 2   },
		{ pk: "ROOM", sk: "ROOMID#3", roomType : "Suite",       price: 1500, available: 6, roomCapacity: 3 },
	];

	const putRequests = itemsToPut.map((item) => ({
		PutRequest: {
			Item: item,
		},
	}));

	const command = new BatchWriteCommand({
		RequestItems: {
			bonzai: putRequests,
		},
	});

	try {
		await docClient.send(command);
		console.log("SUCCESS: De tre rummen har lagts till i 'bonzai'-tabellen.");
	} catch (error) {
		console.error("ERROR: Kunde inte lägga till items.", error);
	}
};

seedDatabase();

// npm i @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
// node data.js
