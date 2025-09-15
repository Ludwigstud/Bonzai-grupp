import { client } from "../../services/db.js";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { sendResponse } from "../../services/response.js";

export const handler = async (event) => {
	try {
		const command = new QueryCommand({
			TableName: "bonzai",
			KeyConditionExpression: "pk = :pk",
			ExpressionAttributeValues: {
				":pk": { S: `BOOKING` },
			},
		});

		const result = await client.send(command);

		return sendResponse(200, result);
	} catch (error) {
		return sendResponse(400, "no things");
	}
};
