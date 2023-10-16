import { program, Option, InvalidArgumentError } from "commander";
import { render } from "./render.mjs"

function myParseInt(value, dummyPrevious) {
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    throw new InvalidArgumentError('Not a number.');
  }
  return parsedValue;
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

render(options.subnetTag,
	 options.paymentDriver,
	 options.paymentNetwork,
	 parseInt(options.memory, 10),
	 parseInt(options.storage, 10),
	 parseInt(options.threads, 10),
	 parseInt(options.workers, 10),
	 parseInt(options.budget, 10),
	 parseInt(options.startPrice, 10),
	 parseInt(options.cpuPrice, 10),
	 parseInt(options.envPrice, 10),
	 parseInt(options.timeoutGlobal, 10),
	 parseInt(options.timeoutUpload, 10),
	 parseInt(options.timeoutRender, 10),
	 options.scene,
	 options.format,
	 parseInt(options.startFrame, 10),
	 parseInt(options.stopFrame, 10),
	 parseInt(options.stepFrame, 10),
	 options.outputDir,
	 options.verbose
);
