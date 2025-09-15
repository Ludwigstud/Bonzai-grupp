import { client } from "../../services/db.js";
import { BatchWriteItemCommand, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { sendResponse } from "../../services/response.js";
import crypto from "crypto";

export const handler = async (event) => {
	try {
		const { name, email, startDate, endDate, rooms } = JSON.parse(event.body);

		for (const room of rooms) {
			if (room.people > room.roomType) {
				return sendResponse(400, {
					message: `Validation failed: A room with type '${room.roomType}' cannot hold '${room.people}' people.`,
				});
			}
		}

		const getRoomPromises = rooms.map((room) => {
			const getCommand = new GetItemCommand({
				TableName: "bonzai",
				Key: {
					pk: { S: "ROOM" },
					sk: { S: `ROOMID#${room.roomType}` },
				},
			});
			return client.send(getCommand);
		});

		const roomResults = await Promise.all(getRoomPromises);

		for (const result of roomResults) {
			if (!result.Item || Number(result.Item.available.N) <= 0) {
				return sendResponse(400, {
					message: "Sorry, one or more requested rooms are no longer available.",
				});
			}
		}

		const bookingId = crypto.randomBytes(8).toString("hex");
		const roomCosts = { 1: 500, 2: 1000, 3: 1500 };
		let totalCost = 0;
		let totalGuests = 0;
		const nameSplit = name.split(" ");

		const bookingItems = [];
		rooms.forEach((room, index) => {
			const cost = roomCosts[room.roomType];
			totalCost += cost;
			totalGuests += room.people;

			bookingItems.push({
				PutRequest: {
					Item: {
						pk: { S: `BOOKING` },
						sk: { S: `ROOM#${bookingId}#${nameSplit[0]}#${index + 1}` },
						name: { S: name },
						email: { S: email },
						startDate: { S: startDate },
						endDate: { S: endDate },
						cost: { N: String(cost) },
						roomType: { N: String(room.roomType) },
						people: { N: String(room.people) },
					},
				},
			});
		});

		bookingItems.push({
			PutRequest: {
				Item: {
					pk: { S: `BOOKING#${bookingId}` },
					sk: { S: "TOTAL" },
					name: { S: name },
					email: { S: email },
					startDate: { S: startDate },
					endDate: { S: endDate },
					cost: { N: String(totalCost) },
					totalGuests: { N: String(totalGuests) },
					totalRooms: { N: String(rooms.length) },
				},
			},
		});

		const batchWriteCommand = new BatchWriteItemCommand({
			RequestItems: { bonzai: bookingItems },
		});
		await client.send(batchWriteCommand);

		const updateRoomPromises = roomResults.map((result) => {
			const roomItem = result.Item;
			const currentAvailability = Number(roomItem.available.N);

			const putCommand = new PutItemCommand({
				TableName: "bonzai",
				Item: {
					pk: roomItem.pk,
					sk: roomItem.sk,
					cost: roomItem.cost,
					roomType: roomItem.roomType,
					available: { N: String(currentAvailability - 1) },
				},
			});
			return client.send(putCommand);
		});

		await Promise.all(updateRoomPromises);

		return sendResponse(201, {
			Bookingnumber: `${bookingId}`,
			Name: `${name}`,
			Rooms: `${rooms.length}`,
			Guests: `${totalGuests}`,
			Cost: `${totalCost}KR`,
			Checkin: `${startDate}`,
			Checkout: `${endDate}`,
		});
	} catch (error) {
		console.error("Error creating booking:", error);
		return sendResponse(500, { message: "Could not create booking.", error: error.message });
	}
};
