import { combineReducers } from "redux";
import vessels from "./vesselReducer";
import messages from "./messagesReducer";

export default combineReducers({
	vessels,
	messages
})