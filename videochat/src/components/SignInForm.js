import React, { Component } from 'react';
import { Platform } from 'react-native';
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
            description: null,
            publisherNumber: 0,
            publisherID: null,
            message: null };

            setupMediaStream() {
              const { videoURL, stream1, isFront, startStream, peerNumber } = this.state;

              let videoSourceId;
              // on android, you don't have to specify sourceId manually, just use facingMode
              if (Platform.OS === 'ios') {
                MediaStreamTrack.getSources((sourceInfos) => {
                  console.log('sourceInfos: ', sourceInfos);

                  for (let i = 0; i < sourceInfos.length; i++) {
                    const sourceInfo = sourceInfos[i];
                    if (sourceInfo.kind === 'video' && sourceInfo.facing === (isFront ? 'front' : 'back')) {
                      videoSourceId = sourceInfo.id
                    }
                  }
                });
              }
              getUserMedia(
                {
                audio: true,
                video: {
                  mandatory: {},
                  facingMode: isFront ? 'user' : 'environment',
                  optional: (videoSourceId ? [{ sourceId: videoSourceId }] : []),
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
                      peers,
                      publisherNumber,
                      publisherID,
                      message } = this.state;
              console.log('subscribe()');

              // this.setState({ socket: io.connect(this.state.serviceAddress) });

              console.log('Connected to Stream Server');
              console.log(this.state.socket);

              // this.state.socket.emit('subscribe rooms', this.state.roomName);
              // console.log('socket.emit subscribe rooms');
              console.log(this.state.userID);
              console.log(this.state.roomNameInput);
              console.log(this.state.pin);

              this.state.socket.emit('subscribe', this.state.userID, this.state.roomNameInput, this.state.pin);
              console.log('socket.emit subscribe');

              // When it receives a subscriber ready message, add user to peers
              this.state.socket.on('subscriber ready', (clientID) => {
                console.log('Subscriber ready from: ');
                console.log(clientID);
                this.setState({ clientID });


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
                  console.log('List: ');
                  console.log(list);

                  let peerNumberOf = this.state.peerNumberOf;
                  peerNumberOf[clientID] = list.length - 1;
                  this.setState({ peerNumberOf });
                  this.setState({ peerNumber: peerNumberOf[clientID]});

                  this.joinRoom(); //peerNumber
                } else {
                  //If client is on record
                  const peerNumberOfHelper = this.state.peerNumberOf;
                  const clientIDHelper = this.state.clientID;
                  console.log('Already connected to this peer. Initialzing stream');


                  const peerNumber = peerNumberOfHelper[clientIDHelper];
                  this.setState({ peerNumber });

                  this.joinRoom();
                }
                }
                });

              this.state.socket.on('publisher ready', (publisherID, publisherNumber) => {
                this.setState({ publisherID });
                this.setState({ publisherNumber });
                console.log('publisherID: ');
                console.log(publisherID);
                console.log('Publisher ready from: ');
                console.log(this.state.publisherNumber);

                // If the peer doesn't exist, create a new PC and add it to list of peers
                // If it does exist, reset the publisher number and the on addstream function
                // so that the peer number is correct.
                if (this.state.userID !== publisherID) {
                  const list = this.state.peers;
                  list.push({ userID: publisherID,
                              number: (list.length),
                              peerConnection: this.state.newPeerconnection,
                              publisherNumber });
                  this.setState({ peers: list });

                  const peerNumberOfHelper = this.state.peerNumberOf;
                  peerNumberOfHelper[publisherID] = list.length - 1;

                  this.setState({ peerNumberOf });
                  this.setState({ peerNumber: list.length - 1 });
                } else {
                  const list = this.state.peers;
                  const peerNumberOfHelper = this.state.peerNumberOf;
                  list[peerNumberOfHelper[publisherID]].publisherNumber = publisherNumber;
                  this.setState({ peers: list });

                  list[peerNumberOfHelper[publisherID]].peerConnection.onaddstream((event) => {
                    console.log('Received remote stream');
                    // View video
                    console.log('Adding stream to: ');
                    console.log(list[peerNumberOfHelper[publisherID]].publisherNumber);
                    console.log('for peer: ');
                    console.log(publisherID);
                  });
                }

                // this.onAddNewPublisher(); // publisherNumber
              });

              this.state.socket.on('signal', (message) => {
                this.gotMessageFromServer(); // message
              });

              this.state.socket.on('disconnect user', (userID, roomName) => {
                const peerNumberOfHelper = this.state.peerNumberOf;
                if (peerNumberOfHelper.hasOwnProperty(userID)) {
                  const list = this.state.peers;
                  this.setState({ peerNumber: peerNumberOf[userID] });
                  if (list[this.state.peerNumber].hasOwnProperty('publisherNumber')) {
                    //onDeletePublisher
                  }
                  list.splice(this.state.peerNumber, 1);
                  this.setState({ peers: list });
                }
              });
              }

            shareStream() {
              const { stream1, startStream, peerNumber, localStreams, peers, description, newPeerConnection } = this.state;
              console.log('shareStream()')

              console.log('this.state.localStream:');
              console.log(this.state.localStreams);
              let localStreamsHelper = this.state.localStreams;
              console.log('This.state.localStreamsHelper');
              console.log(localStreamsHelper);
              console.log('this.state.peerNumber');
              console.log(this.state.peerNumber);
              console.log('this.state.stream1');
              console.log(this.state.stream1);
              localStreamsHelper[this.state.peerNumber] = this.state.stream1;
              console.log('localStreamsHelper');
              console.log(localStreamsHelper);
              this.setState({ localStreams: localStreamsHelper });
              console.log(this.state.localStreams);

              const peersHelper = this.state.peers;
              const peerNumberHelper = this.state.peerNumber;
              console.log(this.state.newPeerConnection);

              this.state.newPeerConnection.addStream(this.state.stream1);

              this.state.newPeerConnection.createOffer().then((description) => {
                this.setState({ description });
                this.setAndSendDescription(); // description, peerNumber
              });
            }

            setAndSendDescription() {
              const { peers, peerNumber, description, socket, userID, roomNameInput, newPeerConnection } = this.state;

              const peersHelper = this.state.peers;
              const peerNumberHelper = this.state.peerNumber;
              const descriptionHelper = this.state.description;

              const signalHelper = {
                type: 'sdp',
                sdp: this.state.newPeerConnection.localDescription,
                userID: this.state.userID };

              this.state.newPeerConnection.setLocalDescription(description).then(() => {
                this.state.socket.emit('signal', signalHelper, this.state.userID, this.state.roomNameInput);
              });
            }

            publish() {
              const { startStream, socket, userID, roomNameInput, pin } = this.state;
              this.setState({ startStream: true });
              this.setupMediaStream();

              this.state.socket.emit('publish', this.state.userID, this.state.roomNameInput, this.state.pin);
              console.log('publish');
              // socket.emit('publish rooms', this.state.roomName);
              // socket.on('publish response', (roomExists, passcode) => {
              //   if (!roomExists) {
              //     //Enter pin to protect room
              //   }
              //   else {
              //     // pin = passcode
              //   }
              // });
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
              const { clientID, newPeerConnection, socket, roomNameInput, userID, publisherNumber } = this.state;
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
                  this.state.socket.emit('signal',
                          { type: 'ice', ice: event.candidate, userID: this.state.userID },
                          this.state.peerUserID,
                          this.state.roomNameInput);
                }
              };

              if (this.state.publisherNumber !== null) {
                pc.onaddstream = (event) => {
                  console.log('Received remote stream: ', event.stream);
                  console.log('Adding stream to ', this.state.publisherNumber);

                };
              }
              console.log('Returning peer connection');
              return pc;
            }

  gotMessageFromServer() {
    const { message, userID, peerNumberOf, peers, peerNumber, description } = this.state;
    const signal = this.state.message;
    let peerNumberHelper = -1;
    const peerNumberOfHelper = this.state.peerNumberOf;
    const list = this.state.peers;

    if (signal.userID === this.state.userID) {
      console.log('Received from self');
      return;
    }

    peerNumberHelper = peerNumberHelper[signal.userID];
    this.setState({ peerNumber: peerNumberHelper });

    if (list[peerNumberHelper].userID === signal.userID) {
      if (signal.type === 'sdp') {
        list[peerNumberHelper].peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then( () => {
          //Only create answers in respnse to offers
          if (signal.sdp.type === 'offer') {
            console.log('Got offer');
            list[peerNumberHelper].peerConnection.createAnswer().then( (description) => {
              this.setState({ description });
              this.setAndSendDescription(); // description, peerNumber
            });
          } else {
            console.lot('Got answer');
          }
        });
      } else if (signal.type === 'ice') {
        list[peerNumber].peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
      }
    }
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

        <CardSection>
          <Button onPress={this.publish.bind(this)}>
            Publish
          </Button>
        </CardSection>

        <CardSection>
          <RTCView style={styles.rtc} streamURL={this.state.videoURL} />
        </CardSection>



      </Card>
    );
  }
}

const styles = {
  rtc: {
    height: 640,
    width: 320,
    flex: 1,
    backgroundColor: '#000'
  }
};

export default SignInForm;
