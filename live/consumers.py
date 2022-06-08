import json
from channels.generic.websocket import AsyncWebsocketConsumer

class LiveConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        #each room will have a unique name based on which we will connect clients to different rooms
        #for now we will use only one room and connect all the clients to that particular room
        #this is not recommended in production
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = 'live_%s' % self.room_name
        
        #whenever a new peer tries to connect using a websocket we will add them to this group.
        #in order to add a peer to this group, group_add will be used which takes 2 args
        #first being the group name where the user/peer should be added and the channel_name of the new peers' data channel
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept() #here we simply accept the connection
    
    
    async def disconnect(self, close_code):
        
        #now in order to disconnect the user from the group we will call the group_discard method 
        #it will take in the group name from where the peer needs to be disconnected as first arg and the second being the channel name of the peer which is going to be disconnected
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
            )
        print("disconnected")
    
    
    async def receive(self, text_data):

        #this function runs whenever our consuer receives a messasge from the peer in the group.
        receive_dict = json.loads(text_data) #loads converts js dict to python dict
        message = receive_dict['message']
        action = receive_dict['action']

        if(action == 'new-offer') or (action == 'new-answer'):
            receiver_channel_name = receive_dict['message']['receiver_channel_name']

            receive_dict['message']['receiver_channel_name'] = self.channel_name
            await self.channel_layer.send(
                receiver_channel_name,
            {
                'type': 'send.sdp',
                'receive_dict': receive_dict
            } 
        )
            return    

        receive_dict['message']['receiver_channel_name'] = self.channel_name #done correct

        #this will broadcast the message that our consumer received to all the channels in the group using group_send 
        #it takes the group name as first arg and the second one being a dict where it is mandatory to have a key called type
        await self.channel_layer.group_send( #done correct
            self.room_group_name,
            {
                'type': 'send.sdp',
                'receive_dict': receive_dict
            }
        )

    async def send_sdp(self, event):#done correct
        receive_dict = event['receive_dict']
        
        #using this self.send to send the message and json.dumps to convert python dict to js dict
        await self.send(text_data=json.dumps(receive_dict))