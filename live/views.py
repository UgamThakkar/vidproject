from django.shortcuts import render, redirect
from django.shortcuts import get_object_or_404
from .models import Chat
# Create your views here.

def index(request):
    if request.method == 'POST':
        room = request.POST['room']
        get_room = Chat.objects.filter(room_name=room)
        if(get_room):
            c = get_room[0]
            number = c.allowed_users
            if int(number)<10:
                number =10 
                return redirect(f'/live/{room}/join')
        else:
            create = Chat.objects.create(room_name=room, allowed_users=1)
            if create:
                return redirect(f'/live/{room}/created')
    return render(request, 'live/index.html')


# def live(request):
#     if request.method == 'POST':
#         user = request.POST.get('user')
#         return redirect(f'/live/created')

#     return render(request, 'live/index.html')




def join_room(request):
    if request.method == 'POST':
        room = request.POST['room']
        get_room = Chat.objects.filter(room_name=room)
        if(get_room):
            c = get_room[0]
            number = c.allowed_users
            if int(number)<10:
                number =10 
                return redirect(f'/live/{room}/join')
        else:
            create = Chat.objects.create(room_name=room, allowed_users=1)
            if create:
                return redirect(f'/live/{room}/created')
    return render(request, 'live/join.html')



def room(request, room_name, created):
    return render(request, 'live/room.html', {'room_name': room_name, 'user': request.user, 'created':created})


# def third(request, room_name, joined):
#     if request.method == 'POST':
#         room = request.POST['room']
#         get_room = Chat.objects.filter(room_name=room)
#         if(get_room):
#             return redirect(f'/live/{room}/join')
#         else:
#             return render(request, 'live/third.html', {'joined': joined})