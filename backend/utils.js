function get_mysql_date() {
	return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function send_event_to_client(client, event) {
	if(client)
		client.response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function get_client(clients, clientid) {
	var client = clients.filter(obj => {
		return obj.id === clientid;
	})
	if(client.length != 0)
		return client[0];
	else
		return null;
}

function range(start, stop, step) {
	var res = [];
	var i = start;
	while (i<stop) {
		res.push(i);
		i += step;
	}
	return res;
}

module.exports = {get_mysql_date, send_event_to_client, get_client, range}