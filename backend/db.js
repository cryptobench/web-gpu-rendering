require("./global.js");

function get_job_tasks_done(jobid) {
  	var sql = `SELECT frame FROM tasks WHERE (jobid = ${jobid}) AND (status = 'DONE');`;
	return execSql(sql)
	.then(function (result) {
		return result.map(task => task.frame);
	})
}

function update_table_entry_by_id(tablename, idfieldname, id, data) {
  	var sql = `UPDATE ${tablename} SET `;
  	var comma = '';
  	for (const [key, value] of Object.entries(data)) {
	    sql += `${comma}${key} = '${value}'`
	    comma = ', '
	}
	if(typeof(id) == "number")
  		sql += ` WHERE ${idfieldname} = ${id};`;
  	else
  		sql += ` WHERE ${idfieldname} = '${id}';`;
	return execSql(sql)
	.then(function (result) {
		return result;
	})
}

function get_job() {
	var job = null;
  	var jobSql = `SELECT * FROM jobs WHERE status != "DONE" ORDER BY createdat ASC LIMIT 1;`;
	return execSql(jobSql)
	.then(function (result) {
		if(result.length != 0)
		{
			job = result[0];
			var ParametersSql = `SELECT * FROM parameters WHERE parametersid = ${job.parametersid};`;
			return execSql(ParametersSql)
		}
		else return null;
	})
	.then(function (result) {
		return !result?null:{job: job, parameters: result[0]};
	})
	.then(function (result) {
		if(result)
			return get_job_tasks_done(result.job.jobid)
			.then(function (result2) {
				result.already_done = result2;
				return result;
			})
		else
			return result;
	})
}

function add_job(	memory, storage, threads, workers, budget, startprice, cpuprice, envprice, timeoutglobal, timeoutupload, timeoutrender, scene, format,
					startframe, stopframe, stepframe, outputdir, clientid, jobuuid, jobindex, walletaddress, whitelist, blacklist) {
  	return insert_parameters(	memory, storage, threads, workers, budget, startprice, cpuprice, envprice, timeoutglobal, timeoutupload, timeoutrender,
  								scene, format, startframe, stopframe, stepframe, outputdir, whitelist, blacklist)
	.then(function (result) {
		return insert_job(clientid, jobuuid, jobindex, walletaddress, result.insertId);
	})
}

function insert_parameters(	memory, storage, threads, workers, budget, startprice, cpuprice, envprice, timeoutglobal, timeoutupload, timeoutrender, scene,
							format, startframe, stopframe, stepframe, outputdir, whitelist, blacklist) {
	var sql = `INSERT INTO parameters (	memory, storage, threads, workers, budget, startprice, cpuprice, envprice, timeoutglobal, timeoutupload, timeoutrender, \
										scene, format, startframe,	stopframe, stepframe, outputdir, whitelist,	blacklist)										\																												\
										VALUES (${memory}, ${storage},	${threads}, ${workers},	${budget}, ${startprice}, ${cpuprice}, ${envprice},				\
												${timeoutglobal}, ${timeoutupload}, ${timeoutrender}, '${scene}', '${format}', ${startframe}, ${stopframe}, 	\
												${stepframe}, '${outputdir}', '${whitelist}', '${blacklist}')`;
	return execSql(sql)
	.then(function (result) {
		return result;
	})
}

function insert_job(clientid, jobuuid, jobindex, walletaddress, parametersid) {
	var timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
	var sql = `INSERT INTO jobs (	clientid, jobuuid, jobindex, walletaddress, parametersid, createdat, status, retrycount)									\
									VALUES (${clientid}, ${jobuuid}, '${jobindex}', '${walletaddress}', ${parametersid}, '${timestamp}', 'TODO', 0)`;
	return execSql(sql)
	.then(function (result) {
		return result;
	})
}

function insert_agreement(agreementid, jobid, providerid, providername) {
	var sql = `INSERT INTO agreements (	agreementid, jobid, providerid, providername, status) VALUES ('${agreementid}', ${jobid}, '${providerid}',				\
										'${providername}', 'CREATED')`;
	return execSql(sql)
	.then(function (result) {
		return result;
	})
}

function insert_task(jobid, frame, agreementid, createdat, rendertime, status) {
	var sql = `INSERT INTO tasks (  jobid, frame, agreementid, createdat, rendertime, status) VALUES (${jobid}, ${frame}, '${agreementid}', '${createdat}',		\
									${rendertime}, '${status}')`;
	return execSql(sql)
	.then(function (result) {
		return result;
	})
}

function insert_error(time, error, agreementid, jobid, providerid) {
	var sql = `INSERT INTO errors (	time, error, agreementid, jobid, providerid) VALUES (${time}, '${error}', '${agreementid}', ${jobid}, '${providerid}')`;
	return execSql(sql)
	.then(function (result) {
		return result;
	})
}

function execSql(sql) {
	sql = sql.replace(/\s+/g, ' ');
  	let p = new Promise(function (res, rej) {
	    connection.query(sql, function (err, result) {
	    	if(err)
	    		rej(err);
	    	else
	    		res(result);
	    });
	});
	return p;
}

// TODO, 	add foreign and secondary keys

function createTables() {
	var createJobsTable = 	`create table if not exists jobs(
								jobid BIGINT AUTO_INCREMENT primary key,
								clientid BIGINT,
								jobuuid BIGINT,
								jobindex TINYTEXT,
								walletaddress TINYTEXT,
								parametersid BIGINT,
								createdat TIMESTAMP,
								startedat TIMESTAMP,
								finishedat TIMESTAMP,
								status ENUM('TODO', 'RUNNING', 'RETRY', 'DONE'),
								retrycount SMALLINT)`;

	var createParametersTable = 	`create table if not exists parameters(
										parametersid BIGINT AUTO_INCREMENT primary key,
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
										whitelist TEXT,
										blacklist TEXT)`;

	var createTasksTable = 	`create table if not exists tasks(
								taskid BIGINT AUTO_INCREMENT primary key,
		                        jobid BIGINT,
		                        frame INT,
								agreementid VARCHAR(66),
								createdat TIMESTAMP,
								rendertime INT,
		                        status ENUM('REDO', 'DONE'))`;

	var createAgreementsTable = `create table if not exists agreements(
									agreementid VARCHAR(66) primary key,
		                        	jobid BIGINT,
		                        	providerid TINYTEXT,
		                        	providername TINYTEXT,
		                        	status ENUM('CREATED', 'CONFIRMED', 'REJECTED', 'TERMINATED'),
		                        	reason TINYTEXT,
		                        	deploymenttime INT,
		                        	uploadtime INT,
		                        	cost FLOAT)`;

	var createErrorsTable = `create table if not exists errors(
									errorid BIGINT AUTO_INCREMENT primary key,
		                        	time TIMESTAMP,
		                        	error TEXT,
		                        	agreementid VARCHAR(66),
		                        	jobid BIGINT,
		                        	providerid TINYTEXT)`;

	execSql(createJobsTable)
	.then(function (result) {
		return execSql(createParametersTable);
	})
	.then(function (result) {
		return execSql(createTasksTable);
	})
	.then(function (result) {
		return execSql(createAgreementsTable);
	})
	.then(function (result) {
		return execSql(createErrorsTable);
	})
	.then(function (result) {
		console.log('db tables ready');
	})
	.catch((err) => {
    	console.log("Error: " + err);
  	})
}

module.exports = {execSql, createTables, get_job_tasks_done, update_table_entry_by_id, get_job, add_job, insert_parameters, insert_job, insert_agreement, insert_task, insert_error}