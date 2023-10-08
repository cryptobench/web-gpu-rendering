// docker run --name mysql -e MYSQL_ROOT_PASSWORD=rootpassword -e MYSQL_USER=user -e MYSQL_PASSWORD=userpassword -e MYSQL_DATABASE=mydb -p 3306:3306 -d mysql

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require("express-fileupload");
const mysql = require('mysql2');
const fs = require("fs")

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(fileUpload());

const PORT = 3001;

let clients = [];

var connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'user',
	password : 'userpassword',
	database : 'mydb'
});

function checkJobs(mysql_connection) {
	var sql = 'SELECT * FROM jobs WHERE status != "DONE";';
	mysql_connection.query(sql, function (err, result) {
		if(err) {
			throw err;
		}
		else {
			//console.log(result);
		}
	});
}

connection.connect(function(err)
{
  	if (err)
  		throw err;

  	console.log("Connected to MySQL DB");

  	var createJobsTableRequest = `  create table if not exists jobs(
			                        timestamp BIGINT(255) primary key,
			                        clientid BIGINT(255),
									subnettag TINYTEXT,
									paymentdriver TINYTEXT,
									paymentnetwork TINYTEXT,
									memory SMALLINT(255),
									storage SMALLINT(255),
									threads SMALLINT(255),
									workers SMALLINT(255),
									budget SMALLINT(255),
									startprice SMALLINT(255),
									cpuprice SMALLINT(255),
									envprice SMALLINT(255),
									timeoutglobal SMALLINT(255),
									timeoutupload SMALLINT(255),
									timeoutrender SMALLINT(255),
									scene TINYTEXT,
									format TINYTEXT,
									startframe SMALLINT(255),
									stopframe SMALLINT(255),
									outputdir TINYTEXT,
									status ENUM('TODO', 'DONE') default 'TODO'
			                      )`;

	connection.query(createJobsTableRequest, function(err, results, fields) {
		if (err) {
			console.log(err.message);
		}
	});

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

	app.post("/upload", function (req, res) {
		let timeout = req.query.long ? 10000 : 1000;
		setTimeout(() => {
	    	res.status(201).json({ success: true });
	  	}, timeout);

		params = JSON.parse(req.body.params);

		var timestamp = Date.now();
		var scene = req.files.fileField.name;
		var outputdir = __dirname + '/inputs/' + timestamp;

		fs.mkdir(outputdir, function(err) {
			if (err) {
				console.log(err)
			} else {
				fs.writeFile(`${outputdir}/${scene}`, req.files.fileField.data, function(err) {
			    	if(err)
			    		return console.log(err);
			    	else {
			    		var sql = `INSERT INTO jobs (	timestamp, 					\
			    										clientid,					\
														subnettag, 					\
														paymentdriver, 				\
														paymentnetwork, 			\
														memory, 					\
														storage, 					\
														threads, 					\
														workers, 					\
														budget, 					\
														startprice, 				\
														cpuprice, 					\
														envprice, 					\
														timeoutglobal, 				\
														timeoutupload, 				\
														timeoutrender, 				\
														scene, 						\
														format, 					\
														startframe, 				\
														stopframe, 					\
														outputdir) 					\
												VALUES (${timestamp}, 				\
														${params.clientid},			\
														'${params.subnettag}', 		\
														'${params.paymentdriver}',	\
														'${params.paymentnetwork}',	\
														${params.memory}, 			\
														${params.storage}, 			\
														${params.threads}, 			\
														${params.workers}, 			\
														${params.budget}, 			\
														${params.startprice}, 		\
														${params.cpuprice}, 		\
														${params.envprice}, 		\
														${params.timeoutglobal}, 	\
														${params.timeoutupload}, 	\
														${params.timeoutrender}, 	\
														'${scene}', 				\
														'${params.format}', 		\
														${params.startframe}, 		\
														${params.stopframe}, 		\
														'${outputdir}')`;

						sql = sql.replace(/\s+/g, ' ');
						connection.query(sql, function (err, result) {
							if(err) {
								throw err;
							}
							else {
								var client = clients.filter(obj => {
									return obj.id === params.clientid
								})

								client[0].response.write(`data: {"sql": "${sql}"}\n\n`);
							}
				  		});
			    	}
				});
			}
		})
	});

	var interval = setInterval(checkJobs, 1000, connection);
});
