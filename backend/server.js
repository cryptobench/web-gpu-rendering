// docker run --name mysql -e MYSQL_ROOT_PASSWORD=rootpassword -e MYSQL_USER=user -e MYSQL_PASSWORD=userpassword -e MYSQL_DATABASE=mydb -p 3306:3306 -d mysql

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require("express-fileupload");
const mysql = require('mysql2');
const fs = require("fs")
const { spawn } = require("child_process");
const child_process = require("child_process");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(fileUpload());

const PORT = 3001;
var clients = [];
var mutex = false;

var connection = mysql.createConnection({
	host     : process.env['HOST_BACKEND'],
	user     : 'user',
	password : 'userpassword',
	database : 'mydb'
});

async function render(	subnetTag,
						paymentDriver,
						paymentNetwork,
						memory,
						storage,
						threads,
						workers,
						budget,
						startPrice,
						cpuPrice,
						envPrice,
						timeoutGlobal,
						timeoutUpload,
						timeoutRender,
						scene,
						format,
						startFrame,
						stopFrame,
						stepFrame,
						outputDir,
						verbose) {
	const ggr = await import("./render.mjs");
	return ggr.render(	subnetTag,
						paymentDriver,
						paymentNetwork,
						memory,
						storage,
						threads,
						workers,
						budget,
						startPrice,
						cpuPrice,
						envPrice,
						timeoutGlobal,
						timeoutUpload,
						timeoutRender,
						scene,
						format,
						startFrame,
						stopFrame,
						stepFrame,
						outputDir,
						verbose);
}

function set_mutex(state) {
	mutex = state;
}

function get_mutex() {
	return mutex;
}

function checkJobs() {
	//console.log('checkJobs')
	if(!get_mutex()) {
		set_mutex(true);
		var sql = 'SELECT * FROM jobs WHERE status != "DONE" ORDER BY timestamp ASC LIMIT 1;';
		connection.query(sql, function (err, result) {
			if(err) {
				set_mutex(false);
				throw err;
			}
			else if(result.length != 0) {
				var res = result[0];
				render( res.subnettag,
					res.paymentdriver,
					res.paymentnetwork,
					res.memory,
					res.storage,
					res.threads,
					res.workers,
					res.budget,
					res.startprice,
					res.cpuprice,
					res.envprice,
					res.timeoutglobal,
					res.timeoutupload,
					res.timeoutrender,
					`${res.outputdir}/${res.scene}`,
					res.format,
					res.startframe,
					res.stopframe,
					res.stepframe,
					res.outputdir,
					"false").then((data) => {

						var sql = `UPDATE jobs SET status = "DONE" WHERE timestamp = ${res.timestamp}`;
						connection.query(sql, function (err, result) {
							set_mutex(false);
							if(err)
								throw err;
							else {
								console.log(`${res.outputdir}/${res.scene}`);
								var cmd = spawn('blender', ['-b', `${res.outputdir}/${res.scene}`, '--python', './assemble_frames.py']);
								cmd.on('close', (code) => {
									child_process.execSync(`zip -r ${res.timestamp} *`, {
									  cwd: res.outputdir
									});
									var client = clients.filter(obj => {
										return obj.id === res.clientid
									})
									client[0].response.write(`data: {"ready": "${res.timestamp}", "idx": "${res.idx}"}\n\n`);
								});
							}
						});
					});		// verbose

			}
			else
				set_mutex(false);

		});
	}
	else {
		//console.log('job running');
	}
}

connection.connect(function(err)
{
  	if (err)
  		throw err;

  	console.log("Connected to MySQL DB");

  	var createJobsTableRequest = `  create table if not exists jobs(
			                        timestamp BIGINT primary key,
			                        clientid BIGINT,
			                        idx TINYTEXT,
									subnettag TINYTEXT,
									paymentdriver TINYTEXT,
									paymentnetwork TINYTEXT,
									memory SMALLINT,
									storage SMALLINT,
									threads SMALLINT,
									workers SMALLINT,
									budget SMALLINT,
									startprice SMALLINT,
									cpuprice SMALLINT,
									envprice SMALLINT,
									timeoutglobal SMALLINT,
									timeoutupload SMALLINT,
									timeoutrender SMALLINT,
									scene TINYTEXT,
									format TINYTEXT,
									startframe INT,
									stopframe INT,
									stepframe INT,
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

	app.get("/download", (req, res) => {
		res.download(`inputs/${req.query.filename}/${req.query.filename}.zip`);
	});

	app.post("/upload", function (req, res) {
		let timeout = req.query.long ? 10000 : 1000;
		setTimeout(() => {
	    	res.status(201).json({ success: true });
	  	}, timeout);

		var params = JSON.parse(req.body.params);
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
			    		var cmd = spawn('blender', ['-b', `${outputdir}/${scene}`, '--python', './get_blend_infos.py']);
						cmd.stdout.on('data', (data) => {
							var sdatas = data.toString().split("\n");
							for(sdata of sdatas) {
								try {
									var sdata2 = sdata.trim().replaceAll("'", '"');
									var jsondata = JSON.parse(sdata2);

// VALUES (${timestamp}, ${params.clientid},'${params.subnettag}', '${params.paymentdriver}', '${params.paymentnetwork}', ${params.memory}, ${params.storage}, ${params.threads},
// 		${params.workers}, ${params.budget}, ${params.startprice}, ${params.cpuprice}, ${params.envprice}, ${params.timeoutglobal}, ${params.timeoutupload}, ${params.timeoutrender},
// 		'${scene}', '${params.format}', ${params.startframe}, ${params.stopframe}, ${params.stepframe}, '${outputdir}')`;

						 			var sql = `INSERT INTO jobs (	timestamp, 			\
			   			 											clientid,			\
			   			 											idx,				\
																	subnettag, 			\
																	paymentdriver, 		\
																	paymentnetwork, 	\
																	memory, 			\
																	storage, 			\
																	threads, 			\
																	workers, 			\
																	budget, 			\
																	startprice, 		\
																	cpuprice, 			\
																	envprice, 			\
																	timeoutglobal, 		\
																	timeoutupload, 		\
																	timeoutrender, 		\
																	scene, 				\
																	format, 			\
																	startframe, 		\
																	stopframe, 			\
																	stepframe, 			\
																	outputdir) 			\
															VALUES (${timestamp}, 		\
																	${params.clientid},	\
																	${params.idx},		\
																	'norbert', 			\
																	'erc20',			\
																	'goerli',			\
																	8, 					\
																	1, 					\
																	4, 					\
																	3, 					\
																	1, 					\
																	1000, 				\
																	1000, 				\
																	1000, 				\
																	4, 					\
																	5, 					\
																	5, 					\
																	'${scene}', 		\
																	'PNG', 				\
																	${jsondata.start}, 	\
																	${jsondata.end}, 	\
																	${jsondata.step}, 	\
																	'${outputdir}')`;

									sql = sql.replace(/\s+/g, ' ');
									connection.query(sql, function (err, result) {
										if(err) {
											throw err;
										}
										else {}
							  		});

								} catch (error) {}
							}
						});
			    	}
				});
			}
		})
	});

	var interval = setInterval(checkJobs, 1000, connection);
});
