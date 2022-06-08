from django.urls import path

from . import views
app_name = 'live'
urlpatterns = [
    path('', views.index, name='index'),
    path('<str:room_name>/<str:created>/', views.room, name='room'),
    path('join', views.join_room, name='join'),
]