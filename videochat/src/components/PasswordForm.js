import React, { Component } from 'react';
import { View } from 'react-native';
import { CardSection, Card, Input, Button } from './common';

class PasswordForm extends Component {
  state = { password: '' };

  render() {
    return (
      <Card>

        <CardSection>
          <View>
            <Text> The room you are entering needs a password. </Text>
          </View>
        </CardSection>

        <CardSection>
          <Input
          label='Password'
          placeholder='*****'
          value={this.state.password}
          onChangeText={password => this.setState({ password })}
          />
        </CardSection>

        <CardSection>
          <Button>Enter Room</Button>
        </CardSection>

      </Card>
    );
  }
}

export default PasswordForm;
