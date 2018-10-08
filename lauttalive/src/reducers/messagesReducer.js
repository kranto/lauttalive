import uuid from 'uuid';

export default function reducer(state={
	messages: [],
	log: [],
	positionLog: [],
	locations: {}
}, action) {
	switch(action.type) {
		case "NEW_MESSAGE":
			const msg = action.payload;
		    msg.id = uuid.v4();
			const messages = state.messages.concat(action.payload); 
			if (messages.length > 150) messages.shift(); 
			return {...state, messages: messages}
		case "STATUS_UPDATE":
		    let time = Date.now();
			let {status, msgId} = action.payload;
			msgId = msgId? msgId: null;
			const log = state.log.concat({time: time, message: status, msgId: msgId});
			if (log.length > 1 && log[log.length-2].msgId !== null && log[log.length-2].msgId === msgId) {
				log.splice(log.length - 2, 1);
			}
			if (log.length > 1000) log.shift(); 
			return {...state, log: log}
		case "POSITION_UPDATE":
			const {entry, changed} = action.payload;
			entry.id = uuid.v4();
			const positionLog = changed? state.positionLog.concat(entry): state.positionLog.slice();
	        positionLog.sort((a,b) => { return a.time - b.time; });
	        if (positionLog.length > 150) positionLog.shift();
	        const locations = {...state.locations};
	        locations[entry.vessel.mmsi] = entry;
			return {...state, positionLog: positionLog, locations: locations}
	}
	return state;
}












