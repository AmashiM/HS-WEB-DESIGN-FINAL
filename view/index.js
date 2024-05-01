
function ce(name, ...args){
	return document.createElement(name, ...args);
}

function e(name, attrs = {}, ...children){
	let _ = document.createElement(name);
	for(let attr of Object.keys(attrs)){
		_.setAttribute(attr, attrs[attr]);
	}

	if(children.length > 0){
		children.forEach(child => {
			if (child instanceof String || typeof child === "string"){
				_.appendChild(text(child));
			} else _.appendChild(child);
		})
	}
	return _
}

function attr(targ, key, value){
	targ.setAttribute(key, value)
}

function del(node){
	node.parentNode.removeChild(node);
}

function button(text, func){
	let btn = document.createElement("button");
	btn.innerText = text;
	btn.onclick = (ev) => { func(); };
	return btn;
}

function ac(targ, child){
	targ.appendChild(child);
}

// this funcion exists to make devs reading the code mad and also to have a quick way to disable console logging
function print(...args){
  // console.log(...args)
}

let ytvid_parser = new RegExp(/(?:https?:\/\/)?(?:www\.)?(?:youtube|youtu|youtube-nocookie)\.(?:com|be)\/(?:watch\?v=|embed\/|v\/|.+\?v=)?(?<videoid>[A-Za-z0-9\-=_]{11})/mg);


function text(txt){
	return document.createTextNode(txt)
}

function request(method, route, data=null){
	return new Promise((res, rej) => {
		let req = { method };
		if(data !== null){
			if(data.d){
				req.body = JSON.stringify(data.d)
			}
		}
		
		fetch(route, req)
			.then(r => r.json())
			.then(res)
			.catch(rej);
	})
}

function message(msg){
	let content = [];


	if(msg.type === "text"){
		content.push(
			e("div", {"class":"app-message-content"}, text(msg.body))
		);
	}
  if(msg.type === "img"){
    content.push(
      e("span", {"class":"app-message-content"},
       e("img", {"src":msg.body, "alt": "image","class":"app-message-image"})
      )
    )
  }

  if(msg.type === "yt"){
    content.push(
      e("iframe", {
        width:560,height:315,
        src: `https://www.youtube-nocookie.com/embed/${msg.body}`,
        title: "YouTube video player",
        frameboarder: "0",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        allowfullscreen: ""
      })
    )
  }
  
  let avatar = e(msg.avatar ? "img" : "div", {
    "src": `/api/user/${msg.author}/avatar`,
    "width": "42px",
    "height": "42px",
    "alt": "profile picture",
    "class": "app-message-avatar"
  });
	
	return e("div", {"class": "app-message"},
    avatar,
		e("div", {"class": "app-message-author-data"},
			e("div", {},
        e("span", {"class":"app-message-username"}, text(msg.username+" ")),
			  e("span", {"class":"app-message-author"}, text(`[${msg.author}]`)), 
      ),
		),
		e('div', {"class": "app-message-body"}, 
      ...content
    )
	);
}


const state = {
	ws: null,
	messages: [],
	message_container: null,
  users: new Map(),
  bring_scroll_down: null
};
let root = document.getElementById("root");
let container = null;
let logged_in = false;
let scene = "home";
let user = {};

function open_ws(){
	if (state.ws !== null) return;
	let ws = new WebSocket(`wss:/${window.location.host}/gateway`);
	ws.onopen = () => {
		print("gateway open");
	}
	ws.onmessage = (ev) => {
		print("msg", ev.data);
		let data = JSON.parse(ev.data);

		print(data);
		switch(data.op){
			case 3: {
				ws.send(JSON.stringify({ op: 1, token: user["token"] }))
			}; break;
			case 4: {
				let msg = data;
				delete msg['op'];
				state.messages.push(JSON.stringify(msg));
				if(state.message_container && scene == "app"){
					ac(state.message_container, message(msg));
          if(state.bring_scroll_down)state.bring_scroll_down()
				}
				if(state.messages.length > 100){
					state.messages.pop(0);
				}
			}; break;
			case 6: {
				request("post", "/api/messages", { d: {token: user.token}})
				.then(value => {
					value.forEach((msg, index) => {
						ac(state.message_container, message(JSON.parse(msg)));
            if(index === value.length -1){
              if(state.bring_scroll_down)state.bring_scroll_down();
            }
					});
          state.messages.push(...value);					
				}).catch(console.error);
			}; break;
			case 0: {
				console.error(value.err);
			}; break;
		}
	}
	ws.onclose = () => {
		print("gateway closed")
		ws = null;
	}
	state.ws = ws;
}



function init(){
	let _ = window.location.href.split(window.location.host)[1];
	if(_.startsWith("/")){
		scene = _.split("/")[1];
	} else {
		scene = "home"
	}

	try {
		let data = JSON.parse(document.cookie);

		if("user" in data){
			logged_in = true;
			user = data["user"];
      request("post", "/api/user/@me", {d:{token:user.token}})
        .then(value => {
          print(value)
          if(!value.ok) return;
          user = value.user
          document.cookie = JSON.stringify({ user: value.user });
          scene_loader()
        }).catch(alert);
		}
	} catch(err){
		print(err);
		// this is called if the json isn't seriable
		document.cookie = "{}";
	}
}

function generate_container(){
	if(container != null){
		del(container);
	}
	container = ce("div", {"id": "container"});
	ac(root, container);
}

function create_navbar(){
	let navbar = ce("nav");
	attr(navbar, "id", "navbar");
	
	let pages = ["home", "about", ...(logged_in ? ["app", "settings"] : ["login"]), "contact"];

	return e("nav", {id:"navbar"},
		...pages.map((page) => {
			let _ = e("span", {}, e('a', {}, text(page)))
			_.onclick = (ev) => {
				scene = page;
				scene_loader();
			};
			return _
		})
	)
}

function page_home(){

	
	return e("div", {id:"home-page"},
    e("p", {}, text("this page is the home page but i'm using it to give instructions to my teacher so they can easily navigate the website to grade me.")),
		e("h2", {}, "Instructions"),
		e("ol", {},
			e("li", {}, "go to login in the nav"),
			e("li", {}, "the login doesn't require and signup just put in a username and password and it'll create an account for you if the username isn't already taken"),
			e("li", {}, "once your logged in its basically just a simple chat app."),
			e("li", {}, "at the bottom of the page you'll see an input, select, and button these make up the input bar. this is used to send messages"),
			e("li", {},
				text("when you're writing in the input bar if you hit enter it'll create a newline. in order to send the message either do "),
				e("code", {}, "ctrl+shift+enter"),
				text(" or hit the send button")
			),
			e("li", {}, "you can also set a pfp/avatar in the settings. (image size isn't checked, cause i didnt feel like it)"),
			e("li", {}, "besides text messages you can also send images whether its a png, jpg, or gif they should all work, and you can also send youtube videos by inputting the link of the youtube video. (the youtube video link is parsed by a regex and im not sure if it works 100% for every youtube video link)")
		),
    e("br"),
    e("section", {},
      e("table", {},
        e("tr", {},
          e("th", {}, text("one")),
          e("th", {}, text("two")),
          e("th", {}, text("three"))
        ),
        e("tr", {},
          e("td", {}, text("a")),
          e("td", {}, text("b")),
          e("td", {}, text("c"))
        ), 
        e("tr", {},
          e("td", {}, text("1")),
          e("td", {}, text("2")),
          e("td", {}, text("3"))
        ),
        e("tfoot", {}, text("i never really use tables."))
      ) 
    )
  )
}

function page_login(){

	let login_username = e("input", {type:"username", name:"username", placeholder:"Username"})

	let login_password = e("input", {type:"password", name:"password", placeholder:"Password"})

	function login_button_pressed(){
		print("hi");

		if(login_username.value.length === 0 || login_password.value.length === 0){
			
			return;
		} else {
			request("post", "/api/login", {d:{
				username: login_username.value,
				password: login_password.value
			}}).then((value) => {
				if(value.err){
					alert(value.err)
				} else {
					logged_in = true;
					print(value)
					user = value;
					document.cookie = JSON.stringify({ user: value });
					scene = "app";
					scene_loader();
				}
			})
		}
	}
  
  let login_form = e("form", {id:"login-form"}, 
			e("label", {"for":"username"}, text("Username: ")),	 
			login_username,
		  e("br"),
			e("label", {"for":"password"}, text("Password: ")),
			login_password,
			e("br"),
			e("input", {type:"submit"})
		)
  
  login_form.onsubmit = (e) => {
    e.preventDefault();
    login_button_pressed();
  }
	
	return e("div", {id: "login-page"},
		login_form
	)
}

function page_app(){
	open_ws()

	let message_box = e("div", {id:"message-box"})
	let message_input = e("textarea", {placeholder:"put some text here",spellcheck:false, autocomplete:"off"});

	state.message_container = message_box;

  state.messages.forEach(msg => {
    ac(state.message_container, message(JSON.parse(msg)));
  });
  
  message_box.scrollTop = message_box.scrollHeight;

  state.bring_scroll_down = () => {
    message_box.scrollTop = message_box.scrollHeight;
  }

  let send_type = e("select", {}, 
    e("option", {value:"text", selected: ""},text("text")),
    e("option", {value:"img"},text("img")),
    e("option", {value:"yt"},text("youtube video"))
  );

  let send_button_clicked = () => {
    if (message_input.value.length > 0){

      let body = message_input.value

      if(send_type.value === "yt"){
        let input = body.trim()

        let res = ytvid_parser.exec(input);
        console.log(res, input);
        
        if(res)body = res[1]
      }

      console.log(body)
			
			state.ws.send(JSON.stringify({
        op: 5,
        body: body,
        type: send_type.value
      }));
			message_input.value = "";
      send_type.value = "text";
      if(state.bring_scroll_down)state.bring_scroll_down();
		}
  }

  message_input.addEventListener("keyup", function(event) {
    if (event.key === "Enter" && event.shiftKey && event.ctrlKey) {
      send_button_clicked()
    }
  });

	return e("div", {},
		message_box,
		e("div", { id: "message-input" },
			e("div", {},
        message_input,
        send_type,
			  button("send", send_button_clicked)
      )
		)
	);
}

function page_about(){
  let code_languages = [
      ["JavaScript", ["I started JS in 4th Grade on Khan academy", "Later in 8th grade I found out about nodejs and other ways to expand my knowledge of JS."]],
      ["HTML", []],
      ["CSS", ["I started html and css at the same time in Mr. Worsham's computer science class in 8th grade junior high."]],
      ["Python", ["After html and css that was when i realized there was a way broader world than just javascript so i tried out different code languages.", "This language to this day is still a go to if i want something done quickly"]],
      ["Sass/Scss", ["After I got the hang of python someone showed me this nonsense and I think it's absolutely hilarious to mess with people by having variables and functions in your css aswell as one of the most hated syntax features."]],
      ["C#", ["I learned C# over the summer after i had completed Worsham's class."]],
      ["C++", []],
      ["C", ["After understanding the basics of C# i realized there was more potential in backend langauges and the stuff you could do with them wasn't as limited so i made the smart decision of learning c and c++ at the same time 🤡."]],
      ["Java", ["This is the most unique of reasons i started learning java. i was trying to help someone with some code and they said \"learning python for me is like you learning java\" so i then proceeded to open the w3schools java quiz and took it in front of them and passwed with a 100%"]],
      ["Dart", ["i wanted to try learning anouther language and this just looked easy"]],
      ["Assembly", ["I chose violence"]],
      ["TypeScript", ["I gave into the JS cultists trying to get me to do TS and i still view it as typescript with extra steps."]]
    ];
  
  let code_langauge_nonsense = e("dl", {},
    ...code_languages.map(([tag, ...descs]) => {
      return e("div", {},
        e("dt", {}, text(tag)),
        ...descs.map(v => e("dd", {}, text(v)))
      )
    })
  );
  
	return e("div", {id:"page-about"},
    e("span", {}, text("this about me is just some info about me the creator")),
    e("hr"),
    e("div", {},
      text("My Name is _____"),
      e("span", { style: "font-size: 10px" }, "(this is a public website and im a minor id rather not.)"),
      e("p", {}, "i'm 16 and i've been coding for almost 8 years. I started in 4th grade on khan academy when i decided not to do my math and instead checked out the other parts of khan academy."),
      e("span", {}, "i mean if you really need to get in contact with me my email is: "),
      e("code", {}, "AmashiMcLane@outlook.com")
    ),
    e("br"),
    e("a", {href:"https://g.dev/Amashi"}, text("this is my google dev page(click me)")),
    e("h2", {}, text("Code Languages")),
    code_langauge_nonsense        
  )
}

function page_settings(){

  let avatar = e(user.avatar ? "img" : "div", {
    "src": `/api/user/${user.user_id}/avatar`,
    "width": "128px",
    "height": "128px",
    "alt": "profile picture",
    "id": "settings-avatar"
  });

  let avatar_input = e("input", {
    'id':"setting-avatar-input",
    "name":"avatar",
    "type":"url",
    "placeholder": "Url"
  });

  function update_avatar_button_clicked(){

    if(avatar_input.value.length === 0){
      return
    }
    
    request("post", "/api/avatar", {d:{token:user.token, avatar: avatar_input.value}})
      .then(value => {
        if(value.ok){
          user.avatar = value.avatar
          scene_loader();
        }
      }).catch(alert);
    
  }
  
	return e("div", {},
    e('div', {"id":"avatar-setting"},
      e("h1", {}, text("Avatar")),
      e("br"),
      e("div", {"id":"avatar-setting-wrapper"}, 
        avatar,
        e("div", {},
          avatar_input,
          e("br"),
          button("update-avatar", update_avatar_button_clicked)
        )
      )
    )
  )
}

function page_contact(){
  return e("div", {id:"page-contact"},
    e("div", {}, "(this page has no functionality)"),
    e("form", {id:"contact-form"},
      e("h1", {}, text("Contact Form")),
      e("label", {"for":"email"}, text("Email")),
      e('br'),
      e("input", {name:"email", type: "email", required: true }),
      e('br'),
      e("label", {"for":"msg"}, text("Message")),
      e('br'),
      e("textarea", {name:"msg"}, text("")),
      e("br"),
      e("input", {type:"submit"})
     )
  )

}

let scenes = {
	home: page_home,
	login: page_login,
	about: page_about,
	settings: page_settings,
	app: page_app,
  contact: page_contact
}

function scene_loader(){
	generate_container();
	let navbar = create_navbar();
	ac(container, navbar);
  // ac(container, e('br'));


	window.history.pushState(null, scene, scene)
	// document.title = scene
	let _ = scenes[scene in scenes ? scene : "home"]();
	ac(container, _);
  if(scene == "app"){
    if(state.bring_scroll_down)state.bring_scroll_down();
  }
}

init()
scene_loader()