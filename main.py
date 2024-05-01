try:
  from sanic import Sanic, Request, response
except Exception as err:
  print(err)
  import os
  os.system("npm run setup")
  print("hopefully it works now.")
from sanic.worker.manager import WorkerManager
from db import *
import json
from playhouse.shortcuts import model_to_dict
from sanic_sass import SassManifest
import urllib.request
import os
# from sanic_limiter import Limiter, get_remote_address
from typing import Any
# import logging
import secure

# logger = logging.getLogger('websockets')
# logger.setLevel(logging.DEBUG)
# logger.addHandler(logging.StreamHandler())

app = Sanic("app")

# csp = (
#   secure.ContentSecurityPolicy(),
#   )
# secure_headers = secure.Secure(csp=csp)

# @app.middleware("response")
# async def set_secure_headers(request, response):
#   secure_headers.framework.sanic(response)

WorkerManager.THRESHOLD = 2000

# limiter = Limiter(app, key_func=get_remote_address)

manifest = SassManifest('/css', './view', './view', css_type='sass')
manifest.middelware(app)


@app.before_server_start
async def before_server_start(app, loop):
    app.ctx.websockets: "dict[str, Any]" = {}


@app.before_server_stop
async def before_server_stop(app, loop):
    for key, _ws in app.ctx.websockets.items():
        await _ws.close()
    del app.ctx.websockets


def format_message(msg, with_op=True):
    u = get_user(msg.author)
    out = model_to_dict(msg)
    out["username"] = u.username
    out['avatar'] = u.avatar
    out['created_at'] = out['created_at'].strftime("%Y-%m-%dT%H:%M:%SZ")
    if with_op:
        out['op'] = 4
    out = json.dumps(out)
    return out


def token_check(data):
    print(data)
    if not "token" in data:
        return response.json({"err": "missing token"})
    user = get_user_with_token(data["token"])
    if not user:
        return response.json({"err": "no user with that token found"})
    return 0


@app.route(r"/<a:(home|login|about|app|settings|contact|index\.html)?>")
# @limiter.limit("250/hour;50 per 2 minute")
async def go_home(req, a: str):
    return await response.file("./view/index.html")

@app.route("/styles.css")
# @limiter.limit("20/minute")
async def styles(req):
    return await response.file("./view/styles.css")


# @app.route("/js.cookie.js")
# async def cookie_js(req):
#     return await response.file("./view/js.cookie.js")

# @app.route("/showdown.min.js")
# async def showdown_js(req):
#     return await response.file("./view/showdown.min.js")


@app.route("/index.js")
# @limiter.limit("20/minute")
async def script_js(req):
    return await response.file("./view/index.js")


# @app.route("/brython/<file:str>")
# async def brython(req, file: str):
#     return await response.file("./view/Brython-3.11.0/%s" % file)

@app.route("/api/login", methods=["post"])
# @limiter.limit("3/day;2/hour;1/minute")
async def api_login(req: Request):
    data = req.json
    user = login_user(data['username'], data['password'])
    return response.json(model_to_dict(user))


@app.route("/api/user/<userid:str>", methods=["POST"])
# @limiter.limit("10/minute")
async def api_user(req: Request, userid: str):
    data = req.json
    auth = get_user_with_token(data["token"])
    if not auth:
        return response.json({"ok": False, "err": "no token given"})
    if userid != "@me":
        user = get_user(userid)
    else:
        user = auth
    if not user:
        return response.json({})
    else:
        udict = model_to_dict(user)
        if userid != "@me":
            del udict['token']
        return response.json({"ok": True, "user": udict})


@app.route("/api/user/<user_id:str>/avatar")
# @limiter.limit("5/minute")
async def get_avatar(req: Request, user_id: str):
    user = get_user(user_id)
    if not user:
        raise Exception("no user with that id exists")
    else:
        if not user.avatar:
            return response.empty()
        a = [i for i in os.listdir("./rawassets/")
             if i.startswith(str(user.user_id))]
        if len(a) > 0:
            print("found it")
            return await response.file("./rawassets/"+a[0])
        return response.redirect(user.avatar)


@app.route("/api/messages", methods=["POST"])
async def api_messages(req: Request):
    data = req.json
    if not "token" in data:
        return response.json({"err": "missing token"})
    user = get_user_with_token(data["token"])
    if not user:
        return response.json({"err": "no user with that token found"})
    msgs = []
    for msg in get_messages():
        print(model_to_dict(msg))
        msgs.append(format_message(msg, with_op=False))
    return response.json(msgs)


@app.route("/api/avatar", methods=["POST"])
# @limiter.limit("100/day;30/hour;5/minute")
async def set_avatar(req: Request):
    data = req.json
    if not "token" in data:
        return response.json({"err": "missing token"})
    user = get_user_with_token(data["token"])
    if not user:
        return response.json({"err": "no user with that token found"})
    avatar_url = data["avatar"]

    if os.path.exists(f"./rawassets/{user.user_id}.jpg"):
        os.remove(f"./rawassets/{user.user_id}.jpg")

    urllib.request.urlretrieve(avatar_url, f"./rawassets/{user.user_id}.jpg")

    user.avatar = data["avatar"]
    user.save()
    return response.json({"ok": True, "avatar": user.avatar})


@app.websocket("/gateway")
# @limiter.limit("5/minute")
async def websocket(req: Request, ws):
    print(app.ctx.websockets)
    done = False
    user: User = None

    await ws.send(json.dumps({
        "op": 3
    }))

    while not done:
        msg = await ws.recv()
        data = json.loads(msg)
        print(data)
        if "op" in data:
            if data['op'] == 1:
                # if not ("token" in data):
                # 	await ws.send(json.dumps({ "err": "no token provided", "op": 0 }))
                # 	print("no token", data)
                # 	break
                users = User.select().where(User.token == data["token"])

                if len(users) == 0:
                    await ws.send(json.dumps({"err": "no user with that token found", "op": 0}))
                else:
                    user = users.get()
                    print(user)
                if not user:
                    break

                app.ctx.websockets[data['token']] = ws
                await ws.send(json.dumps({"op": 6}))
            else:
                if not user:
                    break

                if data["op"] == 5:
                    if data['body'].startswith("/"):
                        args = data['body'].split(" ")
                        print(args)
                        if args[0] == "/delete":
                            msgs = [i for i in Message.select().where(
                                Message.author == user.user_id).order_by(Message.created_at)]
                            msgs = msgs[::-1]
                            if len(args) > 1:
                                a = int(args[1])
                                for i in range(a):
                                    msgs[i].delete_instance()
                    else:
                        msg = create_message(user, data['body'], data["type"])
                        user = get_user(msg.author)
                        out = format_message(msg)
                        for w in app.ctx.websockets.values():
                            await w.send(out)
        print("Received: ", data)
        print("yo")
        pass

if __name__ == "__main__":
    app.run()