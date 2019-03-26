const express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var hbs = require( 'express-handlebars' );
const mysql = require('mysql'); 
const fs = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
var md5 = require('md5');
var session = require('express-session');
var passport = require('passport');
var mySQLStore = require('express-mysql-session')(session);
var localStrategy = require('passport-local');
var formidable = require('formidable');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const config = require('./config/config.js');




app.engine( 'hbs', hbs( { 
  extname: 'hbs', 
  defaultLayout: 'main', 
  layoutsDir: __dirname + '/views/layouts/',
  partialsDir: __dirname + '/views/partials/'
} ) );




var options = {
	host: config.databaseOptions.host,
	port: config.databaseOptions.port,
	user: config.databaseOptions.user,
	password: config.databaseOptions.password,
	database:config.databaseOptions.database,
	ssl: config.databaseOptions.ssl
};

var sessionStore = new mySQLStore(options);

app.use(session({
	secret:'weasels',
	resave:false,
	saveUninitialized:false,
	store: sessionStore
	//  cookie:{secure:true}
}))


app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
	res.locals.isAuthenticated = req.isAuthenticated();
	next();
});
 

app.use(express.static('public'));


app.set( 'view engine', 'hbs' );

users = [];
connections = [];
clients = {};




server.listen(process.env.PORT || 9080);
console.log('Server running...');



const connection = mysql.createConnection({
	host: config.databaseOptions.host,
	port: config.databaseOptions.port,
	user: config.databaseOptions.user,
	password: config.databaseOptions.password,
	database:config.databaseOptions.database,
	ssl: config.databaseOptions.ssl
});

connection.connect();

//testing connnection 
connection.query('SELECT * FROM Users', function(err, rows, fields) {
	if (err) throw err;
	console.log("DB is connected");
}); 



passport.use(new localStrategy(
	function(username, password, done) {
		//const username = req.body.username;
		//const passwordEntered = req.body.password;
		connection.query('SELECT Password, UserID FROM Users WHERE Username = ?', [username], function(err,results,fields) {
			console.log('Username: '+username);
			console.log('Password: '+results[0].Password);
			console.log('User ID: '+results[0].UserID);

			if (err) {done(err)};

			if (results.length === 0) {
				done(null,false);
			} else {

				if (md5(password) === results[0].Password) {
					var id = results[0].UserID;
					return done(null,id);
				} else {
					return done(null,false);
				}
			}

		})
	}
));


//-----------------------------------------------------------------------------
//	Index
//-----------------------------------------------------------------------------

app.get('/', function(req, res){
	res.render('index');
});

//-----------------------------------------------------------------------------
//	Login
//-----------------------------------------------------------------------------


app.get('/login', function(req, res){
	res.render('login');
});

app.post('/login', passport.authenticate(
	'local', {
		successRedirect:'profile',
		failureRedirect:'login'
	})

);


app.get('/logout', function(req,res){
	req.logout();
	req.session.destroy();
	res.redirect('/');
});



//-----------------------------------------------------------------------------
//	Chat
//-----------------------------------------------------------------------------


app.get('/chat', function(req, res){
	res.render('chat');
});


//-----------------------------------------------------------------------------
//	Register
//-----------------------------------------------------------------------------


app.get('/register', function(req, res, next) {
	//res.send('register');
	res.render('register', { title: 'Register' });
});
  
app.post('/register', function(req, res) {

	const username = req.body.username;
	const lname = req.body.lname;
	const fname = req.body.fname;
	const DOB = req.body.dob;
	const email = req.body.email;
	const password = md5(req.body.password);
  
	
	connection.query('INSERT INTO Users (Username,Password,Email,FirstName,LastName,DOB) values (?,?,?,?,?,?)', [username,password,email,fname,lname,DOB],function(error,results,fields) {
		if(error) throw error;

		connection.query('SELECT LAST_INSERT_ID() ', function(error,results,fields) {
			if(error) throw error; 
			const user_id = results[0];
			req.login(user_id, function(error) {
				res.redirect('login');
			});
			// res.render('profile');
		});
	}); 
});


passport.serializeUser(function(user_id,done){
	done(null, user_id);
});
passport.deserializeUser(function(user_id,done){
	done(null, user_id);
});

//-----------------------------------------------------------------------------
// 	Profile/Updating Profile
//-----------------------------------------------------------------------------

// Passes relevant curret user's relevant data to hbs files base on their UserID
app.get('/profile', authenticationMiddleware(), function(req, res, next){
	var id = req.session.passport.user;
	getProfile(id, req,function(err,data) {
	//	if(err) throw err;
		console.log('Directing to profile,' + data.Username + '\'s data loaded.');
		res.render('profile', {
			username:data.Username,
			password:data.Password,
			email:data.Email,
			firstname:data.FirstName,
			lastname:data.LastName,
			dob:data.DOB
		});
	});
});

// Gets User information from User Table based on a given UserID
function getProfile(id, req, callback) {
	var query_str = 'SELECT * FROM Users Where UserID = ' + id;

	var array = [];
	connection.query(query_str, function(err, rows, fields) {
		if(err) callback(err,null);
		array.push(JSON.stringify(rows[0].Username));
		callback(null, rows[0])
	});
}
app.get('/profileUpdate', function(req, res){
	var id = req.session.passport.user;
	getProfile(id, req,function(err,data) {
		if(err) throw err;
		console.log('Directing to profileUpdate, ' + data.Username + '\'s data loaded');		
		res.render('profileUpdate', {
			username:data.Username,
			password:data.Password,
			email:data.Email,
			firstname:data.FirstName,
			lastname:data.LastName,
			dob:data.DOB
		});
	});
});

// Should be called after clicking 'UPDATE' on profileUpdate.hbs
app.post('/', function(req, res) {
	var id = req.session.passport.user;
	var username = req.body.username;
	var firstname = req.body.firstname;
	var lastname = req.body.lastname;
	var email = req.body.email;
	var dob = req.body.dob;
	var oldpassword = req.body.oldpassword;
	var password1 = req.body.password1;
	var password2 = req.body.password2;
	console.log(username, firstname, lastname, email, dob, oldpassword, password1, password2);

	updateProfile(username, firstname, lastname, email, dob, oldpassword, password1, password2, id, req);
	res.redirect('profile');
});

// TODO: Finish password/information checks, decrypt passwords when changing, update DB with new info when valid 

function updateProfile(username, firstname, lastname, email, dob, oldpassword, password1, password2, id, req) {
	getProfile(id, req, function(err,data) {
		console.log('Original Password: ' + data.Password);
	});

	getProfile(id, req, function(err,data) {
		if (oldpassword === '' && password2 === '' && password1 === '') {
			console.log('Not Changing Password');
		} else {
			console.log('Password change attempted.');
			if(err) throw err;
			if(oldpassword !== data.Password) {
				console.log('Old Password entered was incorrect. Redirected.')
				return;
			}
			if(password1 !== password2) {
				console.log('Password confirmation failed. Redirected.');
				return;
			}
		}
		var query_str = 'SELECT * FROM Users';
		connection.query(query_str, function(err,rows,fields) {
		if(err) throw err;
		console.log('Calling on updateProfile!');
	});
	});
}

//-----------------------------------------------------------------------------
//	Programs
//-----------------------------------------------------------------------------

app.get('/programs', function(req, res) {
	res.render('programs');
});

app.post('/programs', function(req, res) {
	var prgmName, prgmInfo, prgmWebsite, prgmPicture;

	var form = new formidable.IncomingForm();
	form.parse(req);

	form.on('field', function(name, value) {
		if (name == "programName") {
			console.log("name: ", value);
			prgmName = value;
		} else if (name == "programPreview") {
			console.log("info: ", value);
			prgmInfo = value;
		} else if (name == "programSite"){
			console.log("website: ", value);
			prgmWebsite = value;
		}
	})

	form.on('fileBegin', function(name, file) {
		file.path = __dirname + '/uploads/' + file.name;
	});

	form.on('file', function(name, file) {
		console.log('Uploaded ' + file.name);
		prgmPicture = file;
	});

	form.on('end', function() {
		res.send("Form received!");
	});

	connection.query('INSERT INTO Programs (ProgramName,Description,Image,Website) values (?,?,?,?)', [prgmName, prgmInfo, prgmPicture, prgmWebsite], function(error, results, fields) {
		if (error) throw error;

		connection.query('SELECT LAST_INSERT_ID() as program_id', function(error, results, fields) {
			if (error) throw error;
			const program_id = results[0];
			console.log(program_id);

		});
	});
});





//-----------------------------------------------------------------------------
//	Survey
//-----------------------------------------------------------------------------

app.get('/survey', authenticationMiddleware(), function(req, res){

	res.render('survey', {title:'Survey'});
});
app.post('/survey', authenticationMiddleware(), function(req, res){
	var id = req.session.passport.user;
	const answer1 = req.body.A1;
	const answer2 = req.body.A2;
	const answer3 = req.body.A3;
	const answer4 = req.body.A4;
	const answer5 = req.body.A5;
	const answer6 = req.body.A6;
	const answer7 = req.body.A7;
	const answer8 = req.body.A8;
	const answer9 = req.body.A9;
	// const answer10 = req.body.A10;
	// const answer11 = req.body.A11;
	// const answer12 = req.body.A12;
	
	const answer10 = " ";
	const answer11 = " ";
	const answer12 = " ";
	const answer13 = req.body.A13;
	const answer14 = req.body.A14;
	const answer15 = req.body.A15;

	connection.query('INSERT INTO UserSurveyResults VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, answer1,answer2, answer3, answer4, answer5, answer6, answer7, answer8,answer9, answer10, answer11, answer12, answer13, answer14, answer15 ], function(error, results, fields) {
		if (error) throw error;
		console.log('survey results saved.');
	}
		
	);
	res.redirect('programs');
});


//-----------------------------------------------------------------------------
//	Functions
//-----------------------------------------------------------------------------



function authenticationMiddleware () {  
	return (req, res, next) => {
	//	console.log(`req.session.passport.user: ${JSON.stringify(req.session.passport)}`);

	    if (req.isAuthenticated()) return next();
	    res.redirect('login');
	}
}


//was getting error using middleware with the function below


io.sockets.on('connection', function(socket){

	

	connections.push(socket);
	console.log('Connected: %s sockets connected', connections.length);
	
	// Disconnect
	socket.on('disconnect', function(data){
		users.splice(users.indexOf(socket.username), 1);
		updateUsernames();
		connections.splice(connections.indexOf(socket), 1);
		console.log('Disconnected: %s sockets connected', connections.length);
	});
	
	// Send Message
	socket.on('send message', function(data){
		console.log(data);
		io.sockets.emit('new message', {msg: data, user: socket.username});
	});
	
	// Send PM
	socket.on('pm', function(data){
		console.log(data);
		io.to(clients[data.user].socket).emit('new pm', {msg: data.msg, user: socket.username});
	});
	
	// New User
	socket.on('new user', function(data, callback){
		callback(true);
		socket.username = data;
		users.push(socket.username);
		clients[data] = {
			"socket": socket.id
		};
		updateUsernames();
	});
	
	function updateUsernames(){
		io.sockets.emit('get users', users);
	}
});
