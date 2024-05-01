from peewee import *
from string import ascii_letters, digits
import random
import datetime
chars = ascii_letters + digits

def random_id(s=chars, l=8):
    return "".join(random.choices(s, k=l))

db = SqliteDatabase("./save.db")

class Base(Model):
    class Meta:
        database = db

class User(Base):
    user_id = IntegerField(primary_key=True)
    username = TextField(null=False, unique=True)
    password = TextField(null=False)
    avatar = TextField(null=True, default=None)
    token = TextField()

class Message(Base):
    author = TextField()
    body = TextField(null=False)
    type = TextField(default="text")
    created_at = DateTimeField(default=datetime.datetime.now)

models = [User, Message]

db.connect()
db.create_tables(models)

def create_user(username, password):
    return User.create(
        token = random_id(l=18),
        username = username,
        password = password,
        user_id = int(random_id(s=digits)),
        avatar = None
    )

def get_user(user_id):
    return User.get_or_none(user_id=user_id)

def login_user(username, password):
    users = User.select().where(User.username == username)
    l = len(users)

    if l == 0:
        user = create_user(username, password)
        return user
    else:
        user = users.get()
        if user.password == password:
            return user
        else:
            return 1

def get_user_with_token(token):
    users = User.select().where(User.token == token)
    if len(users) == 0:
        return None
    else:
        return users.get()

def create_message(author, body, typ):
    return Message.create(
        author = author.user_id,
        body=body,
        type=typ
    )

def get_messages():
    return Message.select().order_by(Message.created_at).limit(100)

def get_users():
    return User.select().limit(50)