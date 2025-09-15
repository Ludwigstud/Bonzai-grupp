import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "eu-north-1" });
const docClient = DynamoDBDocumentClient.from(client);

const tableName = "bonzai";

const dummyData = [
	{
		pk: "booking",
		sk: "room#S12512#billy#1",
		cost: 1000,
		startDate: "2025-09-22",
		endDate: "2025-09-25",
		name: "Billy Bryson",
		email: "billy@domain.com",
		people: 2,
		roomType: 2,
	},
	{
		pk: "booking",
		sk: "room#S12512#billy#2",
		cost: 1500,
		startDate: "2025-09-22",
		endDate: "2025-09-25",
		name: "Billy Bryson",
		email: "billy@domain.com",
		people: 1,
		roomType: 3,
	},
	{
		pk: "booking",
		sk: "room#S12512#billy#total",
		cost: 2500,
		startDate: "2025-09-22",
		endDate: "2025-09-25",
		name: "Billy Bryson",
		email: "billy@domain.com",
		totalGuests: 3,
		totalRooms: 2,
	},
	{
		pk: "booking",
		sk: "room#K98765#anna#1",
		cost: 1500,
		startDate: "2025-10-10",
		endDate: "2025-10-12",
		name: "Anna Andersson",
		email: "anna@example.se",
		people: 3,
		roomType: 3,
	},
	{
		pk: "booking",
		sk: "room#K98765#anna#total",
		cost: 1500,
		startDate: "2025-10-10",
		endDate: "2025-10-12",
		name: "Anna Andersson",
		email: "anna@example.se",
		totalGuests: 3,
		totalRooms: 1,
	},
	{
		pk: "booking",
		sk: "room#M44556#charlie#1",
		cost: 500,
		startDate: "2025-11-21",
		endDate: "2025-11-23",
		name: "Charlie Clark",
		email: "c.clark@workplace.com",
		people: 1,
		roomType: 1,
	},
	{
		pk: "booking",
		sk: "room#M44556#charlie#2",
		cost: 1000,
		startDate: "2025-11-21",
		endDate: "2025-11-23",
		name: "Charlie Clark",
		email: "c.clark@workplace.com",
		people: 2,
		roomType: 2,
	},
	{
		pk: "booking",
		sk: "room#M44556#charlie#total",
		cost: 1500,
		startDate: "2025-11-21",
		endDate: "2025-11-23",
		name: "Charlie Clark",
		email: "c.clark@workplace.com",
		totalGuests: 3,
		totalRooms: 2,
	},
];

const seedDatabase = async () => {
	console.log(`Seeding database table: ${tableName}...`);

	const putRequests = dummyData.map((item) => ({
		PutRequest: {
			Item: item,
		},
	}));

	const command = new BatchWriteCommand({
		RequestItems: {
			[tableName]: putRequests,
		},
	});

	try {
		await docClient.send(command);
		console.log(
			`✅ Success: ${dummyData.length} items have been added to the '${tableName}' table.`,
		);
	} catch (error) {
		console.error("❌ Error seeding database:", error);
	}
};

seedDatabase();
