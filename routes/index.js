var express = require('express');
var server = require('http').createServer(express);
var router = express.Router();
var redis = require('redis'),
client = redis.createClient();

router.get('/',function(req, res) {
	res.render('index');
});

router.get('/getlist', function(req, response) {
	var event = req.query.event;
	var count=0;
	var resjson={};
	
	client.get(event,function(err,res) {
		// if(res==0) {
			// console.log("empty list");
			// response.end();
		// }
		for (i=1; i<=res; i++) {
			(function(i) {
				client.hgetall(event+":attendee:"+i.toString(),function(err,data){
					if(data != null) {
						count=count+1;
						resjson[count]=data;
					}
					if(i==res)
						json(response,resjson);
				});
			})(i);
		}
		//response.end();
	});
});

router.get('/getemails', function(req, response) {
	var event = req.query.event;
	var count=0;
	var resjson={};
	
	client.get(event,function(err,res) {
		if(res==0) {
			response.end();
			return;
		}
		client.smembers(event+":emails", function(err,res){
			json(response,res);
		});
	});
});

router.post('/addattendee', function(req, response) {
	var event = req.body.event;
	var name = req.body.name;
	var email = req.body.email;
	var company = req.body.company;
	var resjson={};
	
	client.sismember(event+":names",name,function (err,res) {
		//checking to see if the name already exists in the events:names index
		if (res==0) {
			//checking to see if the email already exists in the events:email index
			client.sismember(event+":emails",email, function(err,res) {
				if(res==0) {
					client.incr(event);
					client.get(event, function(err,res) {
						var curID=res;		//the current ID is simply the current count at the EVENT key
						client.hmset(event+":attendee:"+curID, {"name": name, "email": email, "company": company}, function(err, res) {
							console.log('added hash');
						});
						client.sadd(event+":names",name);
						client.sadd(event+":emails",email);
						client.set(event+":name:"+name,curID);
						client.set(event+":email:"+email,curID);
					});
					resjson[0]="Attendee added!";
					json(response,resjson);
				}
				else {
					resjson[0]="Email already registered!";
					json(response,resjson);
				}
			});
		}
		else {
			resjson[0]="Name already registered!";
			json(response,resjson);
		}
	});
});

router.post('/removeattendee', function(req, response) {
	var event = req.body.event;
	var name = req.body.name;
	var email = req.body.email;
	var company = req.body.company;
	var delid=-1;
	
	client.get(event+":name:"+name, function (err,res) {
		delid=res;
		if(delid!=-1) {
			(function() {
				client.del(event+":attendee:"+delid);
				client.srem(event+":names",name);
				client.srem(event+":emails",email);
				client.del(event+":name:"+name);
				client.del(event+":email:"+email);
			})();
			json(response,{0: "Attendee removed."});
		}
	});
});

router.post('/editattendee', function(req, response) {
	var whattochange = req.body.whattochange;
	var oldevent = req.body.original.event;
	var oldname = req.body.original.name;
	var oldemail = req.body.original.email;
	var oldcompany = req.body.original.company;
	var newevent = req.body.edited.event;
	var newname = req.body.edited.name;
	var newemail = req.body.edited.email;
	var newcompany = req.body.edited.company;
	var editid=-1;
	
	//logic is a bit muddled due to asynchronous callback return structure of node-redis
	client.get(oldevent+":name:"+oldname, function (err,res) {
		editid=res;
		if(editid!=-1) {
			if(whattochange=="nameemail") {
				client.sismember(oldevent+":names",newname,function (err,res) {
					if (res==0 || (newname==oldname)) {
						client.sismember(oldevent+":emails",newemail, function(err,res) {
							if(res==0 || (newemail==oldemail)) {
								(function() {
									client.hmset(oldevent+":attendee:"+editid.toString(),{"name": newname, "email": newemail, "company": newcompany}, function(err,res){
										console.log("edited hash");
									});
									client.srem(oldevent+":names",oldname);
									client.srem(oldevent+":emails",oldemail);
									client.sadd(oldevent+":names",newname);
									client.sadd(oldevent+":emails",newemail);
									client.del(oldevent+":name:"+oldname);
									client.del(oldevent+":email:"+oldemail);
									client.set(oldevent+":name:"+newname,editid);
									client.set(oldevent+":email:"+newemail,editid);
								})();
								json(response,{0: "Attendee edited."});
							}
							else	json(response,{0: "not allowed to edit (email already exists)"});
						});
					}
					else	json(response,{0: "not allowed to edit (name already exists)"});
				});
			}
			else {	//only company needs to be changed...
				client.hmset(oldevent+":attendee:"+editid.toString(),{"company": newcompany}, function(err,res){
					json(response,{0: "edited company"});
				});
			}
		}
	});
});

//helper function to encode server response json 
var json = function(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  if(typeof data === "string") res.write(data);
  else res.write(JSON.stringify(data));
  res.end();
};

module.exports = router;
