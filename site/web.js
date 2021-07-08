var express = require('express');
var bodyParser = require('body-parser')
var session = require('express-session')

var app = express();
app.use(bodyParser.urlencoded({
	extended: true
}));

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

var handlebars = require('express-handlebars').create({defaultLayout:'main'});


app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', 7919);

var mysql = require('mysql');
var pool = mysql.createPool({
  connectionLimit : 10,
  host            : 'classmysql.engr.oregonstate.edu',
  user            : '',
  password        : '',
  database        : 'cs340_pazarism'
});

app.get('/',function(req,res){
  res.render('index');
});

app.get('/index',function(req,res){
  res.render('index');
});

/*
app.get('/billing',function(req,res,next){
	var context = {};
	pool.query("SELECT billNum, billDate FROM `Customer Billings`", function(err,rows,fields){
		if(err){
			next(err);
			return;
		}
	context.bill = rows;
	res.render('billing', context);
	});
});
*/

app.get('/billing', function(req,res,next){
	var context = {};
	var sql = "SELECT cb.billNum, cb.billDate, bl.Total FROM `Customer Billings` cb" +
		  " LEFT JOIN " +
		  " (SELECT billNum, sum((tranCount * transTypedSurcharge) + (tranCount * locationPrice )) as Total "+
		  " FROM (SELECT TR.*, LP.billNum, LP.locType, LP.locationPrice, TS.transType, TS.transTypedSurcharge, "+
		" TS.billFreq FROM Transactions as TR " +
		" INNER JOIN " + 
		" (SELECT billNum, lkKey, locType, locationPrice FROM `Location Types` lt " +
		" INNER JOIN " +
		" (SELECT * FROM `Location Bill`) lb " +
		" ON lt.locKey = lb.locKey) as LP " +
		" INNER JOIN " +
		" (SELECT billNum, pbKey, transType, transTypedSurcharge, billFreq FROM `Price Plans` pp " +
		" INNER JOIN " +
		" (SELECT * from `Plan Bill`) pb " +
		" ON pp.planID = pb.planID) as TS " +
		" ON TR.pbKey = TS.pbKey and LP.billNum = TS.billNum) as FQ " +
		" group by billNum) bl " +
		" on cb.billNum = bl.billNum ";
	if(req.session.loggedin)
	{
		sql = sql + " WHERE cb.customerID = " + req.session.clientID;
	}
	pool.query(sql, function(err,rows,fields){
		if(err){
			next(err);
			return;
		}
	context.bill = rows;
	res.render('billing',context);
	});
});

app.post('/billing',function(req,res){
	var sql = "INSERT INTO `Customer Billings` (customerID, billDate) VALUES (?,?)";
	var inserts = [req.body.customerID, req.body.billDate];
	sql = pool.query(sql,inserts,function(error,result,fields){
		if(error){
			res.write(JSON.stringify(error));
			res.end();
		}
		else
		{
			res.redirect('/billing');
		}
	});
});

app.post('/auth', function(req,res, next){

	var ID = req.body.ID;
	req.session.loggedin = true;
	req.session.clientID = ID;
	res.redirect('client');

});	

app.get('/client',function(req,res,next){
	var context = {};
       


	if(req.session.loggedin) {
		pool.query('SELECT * FROM Customers', function(err, rows, fields){
			if(err){
				next(err);
				return;
			}
		context.customer = rows;
	
	//res.render('client',context);
	});
	}


        pool.query('SELECT DISTINCT customerID FROM Customers', function(cerr, crows, cfields){
                         if(cerr){
                                 next(cerr);
                                 return;
                         }
        context.cidlst = crows;
	res.render('client', context);
        });


	/*else{
	res.render('client');
	}*/
});

app.post('/client',function(req,res){
	var sql = "INSERT INTO `Customers`(email,phone,address) VALUES (?,?,?)";
	var inserts = [req.body.email, req.body.phone, req.body.address];
	var context = {};
	sql = pool.query(sql,inserts,function(error,result,fields){
		if(error){
			res.write(JSON.stringify(error));
			res.end();
		}
		else
		{
			res.redirect('/client');
		}
	});
});

app.get('/client_update/:id', function(req,res,next){
	var context = {};
	var sql = 'SELECT * FROM Customers WHERE customerID=?';
	var inserts = [req.params.id];
	pool.query(sql,inserts,function(err,rows,fields){
		if(err){
			next(err);
			return;
		}
	context.customer = rows;
	res.render('client_update',context);
	});
});

app.post('/client_update', function(req,res){
	var sql = 'UPDATE `Customers` SET email=?, phone=?, address=? WHERE customerID=?';
	var inserts = [req.body.email, req.body.phone, req.body.address, req.body.customerID];
	pool.query(sql,inserts,function(error,result,fields){
		if(error){
			res.write(JSON.stringify(error));
			res.end();
		}
		else{
			res.redirect('client');
		}
	});
});

app.get('/location',function(req,res){
	var context = {};
	pool.query('SELECT * FROM `Location Types`',function(err,rows,fields){
		if(err){
			next(err);
			return;
		}
	context.locations = rows;
	res.render('locations', context);
	});
});

app.post('/location',function(req,res){
	var sql = 'INSERT INTO `Location Types`(planID, locType, locationPrice) VALUES (?,?,?)';
	var inserts = [req.body.planID, req.body.locType, req.body.locationPrice];
	pool.query(sql,inserts,function(error, result, fields){
		if(error){
			res.write(JSON.stringify(error));
			res.end();
		}
		else{
			res.redirect('location');
		}
	});
});



app.post('/dtchng', function(req,res,next){
	var DT = req.body.billsDt;
	req.session.dton = true;
	req.session.transdt = DT;
	res.redirect('transactions');
});	



app.get('/transactions',function(req,res,next){

        
	var context = {};
	var sql = "SELECT DISTINCT DATE_FORMAT(billDate, '%Y-%m-%d') as billDate FROM `Customer Billings`";
	if(req.session.loggedin)
	{
		sql = sql + ' WHERE customerID = ' + req.session.clientID;
	}
	pool.query(sql, function(err,rows,fields){
		if(err){
			next(err);
			return;
		}
	context.billdt = rows;


       sql = "SELECT -999 as billNum from `Customer Billings`"; 
       if((req.session.dton) && (req.session.loggedin)){
           sql = "SELECT billNum from `Customer Billings` WHERE  customerID  = " + req.session.clientID +
                             " and billDate = '"  + req.session.transdt + "'"; 
        }
	pool.query(sql, function(bnerr,bnrows,bnfields){
		if(bnerr){
			next(bnerr);
			return;
		}  
           context.billnbr = bnrows;
        });

        sql = "Select 'NA' as billFreq from `Price Plans`"; 
        if((req.session.dton) && (req.session.loggedin)){
          sql = "SELECT DISTINCT billFreq from `Price Plans`  WHERE planID in (SELECT DISTINCT planID FROM `Plan Bill` WHERE billNum IN "+
                " (SELECT DISTINCT billNUM from `Customer Billings` WHERE customerID  = " + req.session.clientID +  
                " AND billDate = '" + req.session.transdt + "' ))";

        }
	pool.query(sql, function(bterr,btrows,btfields){
		if(bterr){
			next(bterr);
			return;
		}
	    context.billf  = btrows;
        });

        sql = "Select 'NA' as transType from `Price Plans`"; 
        if((req.session.dton) && (req.session.loggedin)){
          sql = "SELECT DISTINCT transType from `Price Plans` WHERE planID in (SELECT DISTINCT planID FROM `Plan Bill` WHERE billNum IN "+
                            " (SELECT DISTINCT billNUM from `Customer Billings` WHERE customerID  = " + req.session.clientID +
                            " and billDate = '"  + req.session.transdt + "' ))";
         }
	pool.query(sql, function(bferr,bfrows,bffields){
		if(bferr){
			next(bferr);
			return;
		}
	   context.billt  = bfrows;
        });

        sql = "SELECT 'NA' as locType from `Location Types`"; 
        if((req.session.dton) && (req.session.loggedin)){
          sql = "SELECT DISTINCT locType from `Location Types`  WHERE locKey in (SELECT DISTINCT locKey FROM `Location Bill` WHERE billNum IN "+
                            " (SELECT DISTINCT billNUM from `Customer Billings` WHERE customerID  = " + req.session.clientID + 
                            " and billDate = '"  + req.session.transdt + "' ))";
         }
	pool.query(sql, function(lerr,lrows,lfields){
		if(lerr){
			next(lerr);
			return;
		}  
           context.locf  = lrows;

           context.custid = req.session.clientID; 
      

      });

if((!req.session.dton) && (!req.session.loggedin)){

		sql = "SELECT customerID, billNum, TransNum, `billFreq`, `transType`,  `locType`, `tranCount`,"+
  " (tranCount * transTypedSurcharge) + (tranCount * locationPrice )  as Total" +
  " FROM (SELECT TR.*, customerID, LP.billNum, LP.locType, LP.locationPrice, TS.transType,"+
  " TS.transTypedSurcharge, TS.`billFreq` from Transactions as TR"+
  " INNER JOIN"+
  " (SELECT billNum, lkKey,  locType,  locationPrice FROM `Location Types` lt"+
  " INNER JOIN"+
  "(SELECT * FROM `Location Bill` WHERE `billNum` in ( SELECT DISTINCT billNum FROM `Customer Billings` ) ) lb" +
  " ON lt.locKey = lb.locKey) as LP "+
  " ON TR.lkKey = LP.lkKey"+
  " INNER JOIN"+
  " (SELECT pbKey, transType, transTypedSurcharge, billFreq FROM `Price Plans` pp "+
  " INNER JOIN "+
  " (SELECT * from `Plan Bill` WHERE `billNum` in (  SELECT DISTINCT billNum FROM `Customer Billings` ) ) pb" +
  " ON pp.planID = pb.planID) as TS"+
  " ON TR.pbKey = TS.pbKey"+
  " LEFT JOIN (SELECT DISTINCT customerID, billNum FROM `Customer Billings`) CB "+
  " ON LP.billNum = CB.billNum"+
  " ) as FQ";
}

if((req.session.dton) && (!req.session.loggedin)){

   sql = "SELECT customerID, billNum, TransNum, `billFreq`, `transType`,  `locType`, `tranCount`,"+
  " (tranCount * transTypedSurcharge) + (tranCount * locationPrice )  as Total" +
  " FROM (SELECT TR.*, customerID, LP.billNum, LP.locType, LP.locationPrice, TS.transType,"+
  " TS.transTypedSurcharge, TS.`billFreq` from Transactions as TR"+
  " INNER JOIN"+
  " (SELECT billNum, lkKey,  locType,  locationPrice FROM `Location Types` lt"+
  " INNER JOIN"+
  "(SELECT * FROM `Location Bill` WHERE `billNum` in ( SELECT DISTINCT billNum FROM `Customer Billings` WHERE billDate = '" + req.session.transdt + "'  ) ) lb" +
  " ON lt.locKey = lb.locKey) as LP "+
  " ON TR.lkKey = LP.lkKey"+
  " INNER JOIN"+
  " (SELECT pbKey, transType, transTypedSurcharge, billFreq FROM `Price Plans` pp "+
  " INNER JOIN "+
  " (SELECT * from `Plan Bill` WHERE `billNum` in (  SELECT DISTINCT billNum FROM `Customer Billings`  WHERE billDate =  '"  + req.session.transdt + "'  ) ) pb" +
  " ON pp.planID = pb.planID) as TS"+
  " ON TR.pbKey = TS.pbKey"+
  " LEFT JOIN (SELECT DISTINCT customerID, billNum FROM `Customer Billings`) CB "+
  " ON LP.billNum = CB.billNum"+
  " ) as FQ";

} 


if((!req.session.dton) && (req.session.loggedin)){

		sql = "SELECT customerID, billNum, TransNum, `billFreq`, `transType`,  `locType`, `tranCount`,"+
  " (tranCount * transTypedSurcharge) + (tranCount * locationPrice )  as Total" +
  " FROM (SELECT TR.*, customerID, LP.billNum, LP.locType, LP.locationPrice, TS.transType,"+
  " TS.transTypedSurcharge, TS.`billFreq` from Transactions as TR"+
  " INNER JOIN"+
  " (SELECT billNum, lkKey,  locType,  locationPrice FROM `Location Types` lt"+
  " INNER JOIN"+
  "(SELECT * FROM `Location Bill` WHERE `billNum` in ( " +
  " SELECT DISTINCT billNum FROM `Customer Billings` WHERE customerID = " +  req.session.clientID  + " ) ) lb" +
  " ON lt.locKey = lb.locKey) as LP "+
  " ON TR.lkKey = LP.lkKey"+
  " INNER JOIN"+
  " (SELECT pbKey, transType, transTypedSurcharge, billFreq FROM `Price Plans` pp "+
  " INNER JOIN "+
  " (SELECT * from `Plan Bill` WHERE `billNum` in (  "+
  " SELECT DISTINCT billNum FROM `Customer Billings` WHERE customerID = " +  req.session.clientID  + "   ) ) pb" +
  " ON pp.planID = pb.planID) as TS"+
  " ON TR.pbKey = TS.pbKey"+
  " LEFT JOIN (SELECT DISTINCT customerID, billNum FROM `Customer Billings`) CB "+
  " ON LP.billNum = CB.billNum"+
  " ) as FQ";

}


if((req.session.dton) && (req.session.loggedin)){

   sql = "SELECT customerID, billNum, TransNum, `billFreq`, `transType`,  `locType`, `tranCount`,"+
         " (tranCount * transTypedSurcharge) + (tranCount * locationPrice )  as Total" +
         " FROM (SELECT TR.*, customerID, LP.billNum, LP.locType, LP.locationPrice, TS.transType,"+
         " TS.transTypedSurcharge, TS.`billFreq` from Transactions as TR"+
         " INNER JOIN"+
         " (SELECT billNum, lkKey,  locType,  locationPrice FROM `Location Types` lt"+
         " INNER JOIN"+
         "(SELECT * FROM `Location Bill` WHERE `billNum` in ( SELECT DISTINCT billNum FROM `Customer Billings` WHERE billDate = '" + req.session.transdt + 
         "' and customerID = " +  req.session.clientID + " ) ) lb" +
         " ON lt.locKey = lb.locKey) as LP "+
         " ON TR.lkKey = LP.lkKey"+
         " INNER JOIN"+
         " (SELECT pbKey, transType, transTypedSurcharge, billFreq FROM `Price Plans` pp "+
         " INNER JOIN "+
         " (SELECT * from `Plan Bill` WHERE `billNum` in (  SELECT DISTINCT billNum FROM `Customer Billings`  WHERE billDate = '"  + req.session.transdt + 
         "' and customerID = " +  req.session.clientID + " ) ) pb" +
         " ON pp.planID = pb.planID) as TS"+
         " ON TR.pbKey = TS.pbKey"+
         " LEFT JOIN (SELECT DISTINCT customerID, billNum FROM `Customer Billings`) CB "+
         " ON LP.billNum = CB.billNum"+
         " ) as FQ";

 } 


	pool.query(sql, function(terr,trows,tfields){
		if(terr){
			next(terr);
			return;
		}
	context.trans = trows; 
         res.render('transactions',context);
	});

 
    });
});



app.post('/transactions',function(req,res){


    if((req.session.dton) && (req.session.loggedin)){
        var sql = "INSERT INTO `Transactions`(`pbKey`, `lkKey`, `tranCount`) "+ 
                  " SELECT a.pbKey, b.lkKey, ? as tranCount from" +
                  " (SELECT DISTINCT 1 as merge, pbKey from `Plan Bill` where planID = "+
                  " (SELECT planID from `Price Plans` where billFreq = ? and transType = ? and billNum = ? )) a "+
                  " LEFT JOIN"+ 
                  " (SELECT DISTINCT 1 as merge, lkKey from `Location Bill` where locKey = " +
                  " (SELECT locKey from `Location Types` where locType = ? and billNum = ? )) b " +
                  " on a.merge = b.merge";   

	var inserts = [req.body.trnsnum, req.body.bfid, req.body.btid, req.body.bnum, req.body.loctfq, req.body.bnum];
	/*var inserts = [req.body.trsnum, req.body.bfid, req.body.btid, req.body.locfq];*/
	pool.query(sql,inserts,function(error,result,fields){
		if(error){
			res.write(JSON.stringify(error));
			res.end();
		}
		else{
			res.redirect('transactions');
		}
	});
   }
});



app.get('/delete/:transID', function(req,res,next){
	sql = "DELETE FROM `Transactions` WHERE transNum = ?";
	inserts = [req.params.transID];
	pool.query(sql,inserts, function(err,rows,fields){
		if(err){
			res.write(JSON.stringify(err));
			res.end();	
		}
		else{
		res.redirect('../transactions');
		}
	});
});





app.get('/priceplan',function(req,res){
	var context = {};
	pool.query('SELECT * from `Price Plans`', function(err,rows,fields){
		if(err){
			next(err);
			return;
		}
	context.priceplan = rows;
	res.render('priceplan', context);
	});
});

app.post('/priceplan',function(req,res){
	var sql = 'INSERT INTO `Price Plans` (billFreq, transType, transTypedSurcharge) VALUES (?,?,?)';
	var inserts = [req.body.billFreq, req.body.transType, req.body.transTypedSurcharge];
	pool.query(sql,inserts,function(error,result,fields){
		if(error){
			res.write(JSON.stringify(error));
			res.end();
		}
		else{
			res.redirect('priceplan');
		}
	});
});



app.get('/other-page',function(req,res){
  res.render('other-page');
});



function genContext(){
  var stuffToDisplay = {};
  stuffToDisplay.time = (new Date(Date.now())).toLocaleTimeString('en-US');
  return stuffToDisplay;
}

app.get('/time',function(req,res){
  res.render('time', genContext());
});

app.use(function(req,res){
  res.status(404);
  res.render('404');
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.type('plain/text');
  res.status(500);
  res.render('500');
});

app.listen(app.get('port'), function(){
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});
