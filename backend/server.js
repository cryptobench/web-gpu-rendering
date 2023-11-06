require("./global.js");
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require("express-fileupload");
const mysql = require('mysql2');

const event = require("./event.js");
const worker = require("./worker.js");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(fileUpload());

const PORT = 3001;

var mutex_job = false;
var mutex_queue = false;

connection = mysql.createConnection({
	host     : process.env['HOST_BACKEND'],
	user     : 'user',
	password : 'userpassword',
	database : 'mydb'
});

function send_event_to_client(client, event) {
	if(client)
		client.response.write(`data: ${JSON.stringify(event)}\n\n`);
}

connection.connect(function(err)
{
  	if(err)
  		throw err;

  	db.createTables();

	app.listen(PORT, () => {
		console.log(`Events service listening at http://localhost:${PORT}`)
	})

	function eventsHandler(request, response, next) {
		const headers = {
			'Content-Type': 'text/event-stream',
			'Connection': 'keep-alive',
			'Cache-Control': 'no-cache'
		};

		response.writeHead(200, headers);

		const clientId = Date.now();

		response.write(`data: {"clientId": ${clientId}}\n\n`);

		const newClient = {
			id: clientId,
			response
		};

		clients.push(newClient);

		request.on('close', () => {
			console.log(`${clientId} Connection closed`);
			clients = clients.filter(client => client.id !== clientId);
		});
	}

	app.get('/connect', eventsHandler);

	app.get("/download", (req, res) => {
		res.download(`inputs/${req.query.filename}`);
	});

	app.post("/upload", function (req, res) {
		let timeout = req.query.long ? 10000 : 1000;
		setTimeout(() => {
	    	res.status(201).json({ success: true });
	  	}, timeout);

		var params = JSON.parse(req.body.params);
		var jobuuid = Date.now();
		var scene = req.files.fileField.name;
		var outputdir = `${__dirname}/inputs/${params.clientid}/${jobuuid}`;

		fs.mkdir(outputdir, { recursive: true }, function(err) {
			if(err)
				console.log(err)
			else {
				fs.writeFile(`${outputdir}/${scene}`, req.files.fileField.data, function(err) {
			    	if(err)
			    		return console.log(err);
			    	else {
			    		var cmd = spawn('blender', ['-b', `${outputdir}/${scene}`, '--python', './get_blend_infos.py']);
						cmd.stdout.on('data', (data) => {
							var sdatas = data.toString().split("\n");
							for(sdata of sdatas) {
								try {
									var sdata2 = sdata.trim().replaceAll("'", '"');
									var jsondata = JSON.parse(sdata2);
									client = utils.get_client(clients, params.clientid);

									if((params.startframe < jsondata.start) || (params.startframe > jsondata.end))
										send_event_to_client(client, {event: 'START_FRAME_ERROR', error_message: `start frame must be between ${jsondata.start} and ${jsondata.end}`, jobindex: params.idx});
									else if((params.stopframe < jsondata.start) || (params.stopframe > jsondata.end))
										send_event_to_client(client, {event: 'STOP_FRAME_ERROR', error_message: `stop frame must be between ${jsondata.start} and ${jsondata.end}`, jobindex: params.idx});
									else if(params.stopframe < params.startframe)
										send_event_to_client(client, {event: 'START_STOP_FRAME_ERROR', error_message: 'start frame must be < stop frame', jobindex: params.idx});
									else
										db.add_job(	params.subnettag, params.paymentdriver, params.paymentnetwork, params.memory, params.storage, params.threads, params.workers,
													params.budget, params.startprice, params.cpuprice, params.envprice, params.timeoutglobal, params.timeoutupload, params.timeoutrender, scene,
													params.format, params.startframe, params.stopframe, params.stepframe, outputdir, params.clientid, jobuuid, params.idx, params.walletaddress);

								} catch (error) {}
							}
						});
			    	}
				});
			}
		})
	});

	var interval = setInterval(worker_func, 1000);
	var interval2 = setInterval(event_func, 1000);
});

function worker_func() {
	if(!mutex_job)
	{
		mutex_job = true;
		worker.checkJobs()
		.then(function (result) {
			mutex_job = false;
		});
	}
}

function event_func() {
	if(!mutex_queue)
	{
		mutex_queue = true;
		event.checkQueue(send_event_to_client);
		mutex_queue = false;
	}
}