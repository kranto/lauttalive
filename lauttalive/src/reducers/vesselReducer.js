
export default function reducer(state={
	metadata: [],
	fetchingMetadata: false,
	metadataError: false
}, action) {
	switch(action.type) {
	case "FETCH_METADATA_PENDING":
		return {...state, fetchingMetadata: true, metadataError: false}
	case "FETCH_METADATA_SUCCESS":
		return {...state, fetchingMetadata: false, metadataError: false, metadata: action.payload}
	case "FETCH_METADATA_ERROR":
		return {...state, fetchingMetadata: false, metadataError: action.payload, metadata: null}
	default:
		return state;
	}
}