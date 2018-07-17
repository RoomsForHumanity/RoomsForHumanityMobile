import React, { Component } from 'react';
import { View } from 'react-native';
import { CardSection, Card, Input, Button } from './common';
import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';
import io from 'socket.io-client';


class SignInForm extends Component {
  state = { roomNameInput: '',
            socket: io.connect(('https://stream.roomsforhumanity.org')),
            isFront: true,
            pin: null,
            serviceAddress: '',
            newPeerConnection: null,
            startStream: true,
            localStreams: {},
            clientID: null,
            peerNumber: 0,
            peerNumberOf: { userID: 'peerNumber' },
            peers: [],
            description: null };

            setupMediaStream() {
              const { videoURL, stream1, isFront, startStream, peerNumber } = this.state;
              getUserMedia(
                {
                audio: true,
                video: {
                  mandatory: {},
                  facingMode: isFront ? 'user' : 'environment',
                }
              },
              (stream) => {
                console.log('Setting up stream');
                this.setState({ videoURL: stream.toURL() });
                this.setState({ stream1: stream });
                this.shareStream();  // stream1, startStream, peerNumber
              },
                err => console.error(err)
              );
            }

            subscribe() {
              const { serviceAddress,
                      socket,
                      roomNameInput,
                      roomExists,
                      pin,
                      peerNumberOf,
                      newPeerconnection,
                      peers } = this.state;
              console.log('subscribe()');

              this.setState({ socket: io.connect(this.state.serviceAddress) });

              console.log('Connected to Stream Server');
              console.log(this.state.serviceAddress);
              console.log(this.state.roomName);

              this.state.socket.emit('subsribe', this.state.userID, this.state.roomNameInput, this.state.pin);
              console.log('socket.emit subscribe');

              this.state.socket.emit('subscribe rooms', this.state.roomName);
              console.log('socket.emit subscribe rooms');

              // When it receives a subscriber ready message, add user to peers
              this.state.socket.on('subscriber ready', (clientID) => {
                console.log('Subscriber ready from: ', clientID);
                this.setState({ clientID });
              });

              if (!this.state.peerNumberOf.hasOwnProperty(this.state.clientID)) {
                //If this clientID isn't on record yet, create a new PC and add it to record
                //Then join room
                if (this.state.userID !== this.state.clientID) {
                  const newPeerConnection = this.createPeerConnection();
                  this.setState({ newPeerConnection });

                  let list = this.state.peers;
                  list.push({ userID: this.state.clientID,
                              number: (list.length),
                              peerConnection: this.state.newPeerconnection,
                              setAndSentDescription: false });
                  this.setState({ peers: list });

                  const clientID = this.state.clientID;

                  let peerNumberOf = this.state.peerNumberOf;
                  peerNumberOf[clientID] = list.length - 1;
                  this.setState({ peerNumberOf });
                  this.setState({ peerNumber: peerNumberOf[clientID]});

                  this.joinRoom();
                } else { //If client is on record
                  console.log('Already connected to this peer. Initialzing stream');

                  const peerNumberOf = this.state.peerNumberOf;
                  const clientID = this.state.clientID;
                  const peerNumber = peerNumberOf[clientID];
                  this.setState({ peerNumber });

                  this.joinRoom();
                }
                }
              }

            shareStream() {
              const { stream1, startStream, peerNumber, localStreams, peers, description } = this.state;
              console.log('shareStream()')

              let localStreamsHelper = this.state.localStreams;
              localStreamsHelper[this.state.peerNumber] = this.state.stream1;
              this.setState({ localStreams: localStreamsHelper });

              const peersHelper = this.state.peers;
              const peerNumberHelper = this.state.peerNumber;

              peersHelper[peerNumberHelper].peerConnection.addStream(localStreamsHelper[peerNumberHelper]);

              peersHelper[peerNumberHelper].peerConnection.createOffer().then((description) => {
                this.setState({ description });
                this.setAndSendDescription(); // description, peerNumber
              }).catch(this.errorHandler());
            }

            setAndSendDescription() {
              const { peers, peerNumber, description, socket, userID, roomNameInput } = this.state;

              const peersHelper = this.state.peers;
              const peerNumberHelper = this.state.peerNumber;
              const descriptionHelper = this.state.description;

              const signalHelper = {
                type: 'sdp',
                sdp: peersHelper[peerNumberHelper].peerConnection.localDescription,
                userID: this.state.userID }

              peersHelper[peerNumberHelper].peerConnection.setLocalDescription(description).then(() => {
                this.state.socket.emit('signal', signalHelper, peersHelper[peerNumberHelper].userID, this.state.roomNameInput);
              }).catch(this.errorHandler());
            }

            publish() {
              const { startStream, socket } = this.state;
              this.setState({ startStream: false });
              this.setupMediaStream();
              socket.emit('publish rooms', this.state.roomName);
              socket.on('publish response', (roomExists, passcode) => {
                if (!roomExists) {
                  //Enter pin to protect room
                }
                else {
                  // pin = passcode
                }
              });
            }

            setUpService() {
              const { userID } = this.state;

              //Generate a userID for the user
              const uuid = this.uuid();
              console.log('userID: ');
              console.log(uuid);

              this.setState({ userID: uuid });

              this.subscribe();
            }

            joinRoom() {
              const { peerNumber } = this.state;
              console.log('joinRoom');
              try {
                this.setupMediaStream()
              } catch (err) {
                console.log('error', err);
              }
            }

            createPeerConnection() {
              const { clientID, newPeerConnection, socket, roomNameInput, userID } = this.state;
              const configOptions = { iceServers: [
                        { url: 'stun:stun.l.google.com:19302' },
                        { url: 'turn:numb.viagenie.ca',
                          credential: 'enter1234',
                          username: 'bethin.charles@yahoo.com'
                        }
                        ]
                      };
              const pc = new RTCPeerConnection(configOptions);
              console.log('Created peer connection')
              this.setState({ newPeerConnection: pc });

              pc.onicecandidate = (event) => {
                console.log('onicecandidate');
                if (event.candidate != null) {
                  socket.emit('signal',
                          { type: 'ice', ice: event.candidate, userID: this.state.userID },
                          this.state.peerUserID,
                          this.state.roomNameInput);
                }
              };

              if (this.state.publisherNumber !== null) {
                pc.onaddstream = (event) => {
                  console.log('Received remote stream: ', event.stream);
                };
              }
              console.log('Returning peer connection');
              return pc;
            }

  onGoToChat() {
    const { roomNameInput, socket, serviceAddress } = this.state;

    console.log('Attempting to create a room');
    socket.emit('query rooms', '#' + this.state.roomNameInput);
    socket.on('query response', (exists, pin) => {
      console.log('Received response');
      console.log('Room exists: ');
      console.log(exists);
      console.log('Pin: ');
      console.log(pin);
      if (exists) {
        // Do something if room exists
        this.setState({ serviceAddress: 'https://roomsforhumanity.org/chat.html#' + this.state.roomNameInput });
        this.setUpService();
      } else {
        // The room does not exist
      }
    });
  }

  uuid() {
    // Function to generate userID
    return this.s4() + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + this.s4() + this.s4();
  }

  s4() {
    //Helper function to generate userID
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  render() {
    return (
      <Card>

        <CardSection>
          <Input
          label='Room Name'
          placeholder='abc123'
          value={this.state.roomNameInput}
          onChangeText={roomNameInput => this.setState({ roomNameInput })}
          />
        </CardSection>

        <CardSection>
          <Button onPress={this.onGoToChat.bind(this)}>
            Go Live
          </Button>
        </CardSection>


      </Card>
    );
  }
}


export default SignInForm;
