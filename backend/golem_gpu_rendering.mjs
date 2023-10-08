import { TaskExecutor, Events } from "@golem-sdk/golem-js";
import { program, Option, InvalidArgumentError } from "commander";

function range(start, stop, step) {
	var res = [];
	var i = start;
	while (i<stop) {
		res.push(i);
		i += step;
	}
	return res;
}

function myParseInt(value, dummyPrevious) {
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    throw new InvalidArgumentError('Not a number.');
  }
  return parsedValue;
}

function eventHandler(event) {
	console.log(event);
}

const myFilter = async (proposal) => {
	var decision = false;

	var cpuprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][0]*3600*1000;
	var envprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][1]*3600*1000;
	var startprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][2]*1000;

	//console.log(proposal.properties['golem.node.id.name'], "cpuprice", options.cpuPrice, cpuprice);
	//console.log(proposal.properties['golem.node.id.name'], "envprice", options.envPrice, envprice);
	//console.log(proposal.properties['golem.node.id.name'], "startprice", options.startPrice, startprice);

	if((cpuprice <= options.cpuPrice) && (envprice <= options.envPrice) && (startprice <= options.startPrice))
		decision = true;

	return decision;
};

async function main(subnetTag,
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
					outputDir
					//,verbose
					) {

	if(format in ["OPEN_EXR_MULTILAYER", "OPEN_EXR"])
        var ext = "exr";
    else
        var ext = format.toLowerCase();

	//var myEventTarget = new EventTarget();
	//myEventTarget.addEventListener("GolemEvent", (e) => {
	//	if(verbose == 'true')
	//		console.log(e.timeStamp, e.name, e.detail);
	//});

	const executor = await TaskExecutor.create({
		subnetTag,
		payment: {paymentDriver, paymentNetwork},
		package: "b5e19a68e0268c0e72309048b5e6a29512e3ecbabd355c6ac590f75d",
		proposalFilter: myFilter,
		minMemGib : memory,
		minStorageGib: storage,
		minCpuThreads: threads,	// minCpuCores
		capabilities: ["cuda"],
		logLevel: "debug",
		//yagnaOptions: { apiKey: 'b328628d82144170a87099d0d179aaac' },
		//eventTarget: myEventTarget
	});

	var cmd_display = "PCIID=$(nvidia-xconfig --query-gpu-info | grep 'PCI BusID' | awk -F'PCI BusID : ' '{print $2}') && (nvidia-xconfig --busid=$PCIID --use-display-device=none --virtual=1280x1024 || true) && ((Xorg :1 &) || true) && sleep 5"

	executor.beforeEach(async (ctx) => {
		await ctx
			.beginBatch()
			.uploadFile(scene, "/golem/resources/scene.blend")
			.run(cmd_display)
			.end()
			.catch((e) => console.error(e));
	});

	var frames = range(startFrame, stopFrame + 1, stepFrame);
	console.log(frames);
	const results = executor.map(frames, async (ctx, frame) => {

		var filename = frame.toString().padStart(4, "0");
		var output_file = `${outputDir}/${filename}.${ext}`
    	var cmd_render = `(DISPLAY=:1 blender -b /golem/resources/scene.blend -o /golem/output/ -noaudio -F ${format} -f ${frame.toString()} -- --cycles-device CUDA) || true`

		const result = await ctx
			.beginBatch()
			.run(cmd_render)
			.downloadFile(`/golem/output/${filename}.${ext}`, output_file)
			.end()
			.catch((e) => console.error(e));
		return result?.length ? `${frame}` : "";
	});

	//for await (const result of results)
	//	console.log(result);

	await executor.end();
}

program
	.option("--subnetTag <subnettag>", "subnet tag","norbert")
	.option("--paymentDriver <paymentdriver>", "payment driver", "erc20")
	.option("--paymentNetwork <paymentnetwork>", "payment network", "goerli")
	.option("--memory <memory>", "memory", 8, myParseInt)
	.option("--storage <storage>", "storage", 1, myParseInt)
	.option("--threads <threads>", "threads", 4, myParseInt)
	.option("--workers <workers>", "workers", 3, myParseInt)
	.option("--budget <budget>", "budget", 1, myParseInt)
	.option("--startPrice <startprice>", "start price (mGLM)", 1000, myParseInt)
	.option("--cpuPrice <cpuprice>", "cpu price (mGLM/thread/h)", 1000, myParseInt)
	.option("--envPrice <envprice>", "environment price (mGLM/h)", 1000, myParseInt)
	.option("--timeoutGlobal <timeoutglobal>", "global timeout (h)", 4, myParseInt)
	.option("--timeoutUpload <timeoutupload>", "upload timeout (mn)", 5, myParseInt)
	.option("--timeoutRender <timeoutrender>", "render timeout (mn)", 5, myParseInt)
	.option("--scene <scene>", "scene", "cubes.blend")
	.addOption(new Option("--format <format>", "format").choices(["PNG", "BMP", "JPEG", "OPEN_EXR", "OPEN_EXR_MULTILAYER"]).default("PNG"))
	.option("--startFrame <startframe>", "start frame", 1, myParseInt)
	.option("--stopFrame <stopframe>", "stop frame", 5, myParseInt)
	.option("--stepFrame <stepframe>", "step frame", 1, myParseInt)
	.option("--outputDir <outputdir>", "output directory", "./")
	.addOption(new Option("--verbose <verbose>", "verbose").choices(["true", "false"]).default("false"))
program.parse();

const options = program.opts();

console.log(options);

main(options.subnetTag,
	 options.paymentDriver,
	 options.paymentNetwork,
	 options.memory,
	 options.storage,
	 options.threads,
	 options.workers,
	 options.budget,
	 options.startPrice,
	 options.cpuPrice,
	 options.envPrice,
	 options.timeoutGlobal,
	 options.timeoutUpload,
	 options.timeoutRender,
	 options.scene,
	 options.format,
	 options.startFrame,
	 options.stopFrame,
	 options.stepFrame,
	 options.outputDir,
//	 options.verbose
);
