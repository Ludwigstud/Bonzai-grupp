import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "eu-north-1" }); // Anpassa region
const docClient = DynamoDBDocumentClient.from(client);

const seedDatabase = async () => {
	const itemsToPut = [
		{ pk: "room", sk: "roomId#1", cost: 500, available: 7, roomType: 1 },
		{ pk: "room", sk: "roomId#2", cost: 1000, available: 7, roomType: 2 },
		{ pk: "room", sk: "roomId#3", cost: 1500, available: 6, roomType: 3 },
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
