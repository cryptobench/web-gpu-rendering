function get_mysql_date() {
	return new Date().toISOString().slice(0, 19).replace('T', ' ');
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

module.exports = {get_mysql_date, get_client, range}