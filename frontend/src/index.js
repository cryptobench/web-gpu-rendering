import { StrictMode } from "react";
import ReactDOM from "react-dom";
import { MetaMaskProvider } from "metamask-react";

import './index.css';

import App from "./App";

const rootElement = document.getElementById("root");
ReactDOM.render(
  	<StrictMode>
		<MetaMaskProvider>
  			<App />
  		</MetaMaskProvider>
  	</StrictMode>,
  	rootElement
);