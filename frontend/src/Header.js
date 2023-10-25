import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';
import React, { useState, useEffect } from 'react'

function Header () {

return (
    <Navbar id="Navbar" expand="lg" className="bg-body-tertiary">
        <Container>
            <Navbar.Brand id="navbrand" className='flex items-center'>
                <div className='m-[10px]'>
                    <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className='m-[10px]'>
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
);
}

export default Header;