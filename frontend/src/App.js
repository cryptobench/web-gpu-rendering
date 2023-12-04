import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';
import useScreenSize from 'use-screen-size';
import $ from 'jquery';
import React, { useState, useEffect } from 'react'
import { MyUploader } from "./MyUploader";
import fileDownload from 'js-file-download'
import { useMetaMask } from "metamask-react";
import { ethers } from 'ethers';

import 'bootstrap/dist/css/bootstrap.min.css';

var already_connected_to_backend = false;
var provider = null;

const sse = new EventSource('http://localhost:3001/connect');

function get_file_by_index(allfiles, index) {
    var filewithmeta = allfiles.filter(obj => {
        return obj.meta.id === index;
    })
    return filewithmeta[0];
}

async function sign_message(signer, message) {
    return await signer.signMessage(message);
}

function authenticate(s_clientid, account, SetAuthenticated) {
    provider = new ethers.BrowserProvider(window.ethereum);
    provider.getSigner().then((signer) => {
        sign_message(signer, s_clientid)
        .then((signature) => {
            fetch(`http://localhost:3001/authenticate?clientid=${s_clientid}&signedclientid=${signature}&walletaddress=${account}`)
            .then((resp) => {
                if(resp.status === 200)
                    SetAuthenticated(true);
            });
        })
        .catch((error) => {});
    })
    .catch((error) => {});
}

function App() {

    const [ClientId, SetClientId] = useState(0);
    const [Authenticated, SetAuthenticated] = useState(false);
    const [AllFiles, SetAllFiles] = useState([]);

    const size = useScreenSize();
    const { status, connect, account } = useMetaMask();

    function resize_app() {
        var app_height = $('#App').height();
        var navbar_height = $('#Navbar').outerHeight();
        $('.cdragndrop').height(app_height - navbar_height);
    }

    useEffect(() => {
        resize_app();
    }, [size]);

    if(status === "connected")
    {
        if(!already_connected_to_backend)
        {
            already_connected_to_backend = true;
            authenticate(ClientId.toString(), account, SetAuthenticated);
        }
    }

    sse.onmessage = e => {
        try {
            var data = JSON.parse(e.data);
            console.log(data);
            if(data.event === 'CONNECTED')
                SetClientId(data.clientId);
            else if(data.event === 'JOB_FINISHED') {
                var filename = `${data.clientId}_${data.jobUuid}.zip`
                var req_field = btoa(`${data.clientId}/${data.jobUuid}/${filename}`);
                fetch(`http://localhost:3001/download?filename=${req_field}`)
                    .then(resp => resp.blob())
                    .then(blob => {
                        fileDownload(blob, `${filename}`);
                        var file = get_file_by_index(AllFiles, data.jobIndex);
                        if(file !== undefined)
                            file.remove();
                    })
            }
            else if(['INTERNAL_ERROR_1', 'INTERNAL_ERROR_2', 'INVALID_BLEND_FILE', 'START_FRAME_ERROR', 'STOP_FRAME_ERROR', 'START_STOP_FRAME_ERROR'].includes(data.event))
            {
                var file = get_file_by_index(AllFiles, data.jobIndex);
                if(file !== undefined)
                    file.cancel();
            }
        }
        catch {
            console.log(e.data);
        }
    }

    sse.onerror = () => {
        sse.close();
    }

    return (
        <div id="App" className="App h-100">
            <Navbar id="Navbar" expand="lg" className="bg-body-tertiary">
                <Container>
                    <Navbar.Brand id="navbrand">
                        <div>
                            <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h2>Web GPU Rendering</h2>
                        </div>
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto">
                        <Nav.Link href="#home">Documentation</Nav.Link>
                        <Nav.Link href="#link">About</Nav.Link>
                        <Button variant="primary">Login</Button>
                    </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            <div className="cdragndrop">
                { (status === "initializing") && (
                    <div className="metamask">
                        <div>Synchronisation with MetaMask ongoing...</div>
                    </div>
                )}
                { (status === "unavailable") && (
                    <div className="metamask">
                        <div>MetaMask not available :(</div>
                    </div>
                )}
                { (status === "notConnected") && (
                    <div className="metamask">
                        <Button onClick={connect} variant="primary">Connect to MetaMask</Button>{' '}
                    </div>
                )}
                { (status === "connecting") && (
                    <div className="metamask">
                        Connecting...
                    </div>
                )}
                { (status === "connected") && Authenticated && (
                    <MyUploader clientid={ClientId} walletaddress={account} setallfiles={SetAllFiles}/>
                )}
                { (status === "connected") && !Authenticated && (
                    <div className="metamask">
                        <Button onClick={authenticate} variant="primary">Authenticate</Button>{' '}
                    </div>
                )}
                {resize_app()}
            </div>
        </div>
    );
}

export default App;
