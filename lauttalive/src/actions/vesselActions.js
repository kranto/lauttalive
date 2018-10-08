export function fetchVessels() {
	return {
		type: "FETCH_VESSELS_FULFILLED",
		payload: {
			mmsi: 123,
			name: "asdf"
		}
	}
}
