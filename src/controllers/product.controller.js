const model = require("../models/product.model.js")

module.exports.search=(req, res, next)=> {
  const data = {
    query: req.params.query,
    order: req.body.order,
    page: req.params.page,
    direction: req.body.direction
  }
  if (!Number.isInteger(data.page) && data.page < 0) {
    return res.status(400).json({body:"invalid page field"})
  }
  const callback = (err, results, fields) => {
    if (err) {
      console.error("error searching", err)
      return res.status(500).json(err)
    }
    //make the # of listings shown match the page
    // assume 15 listings per page
    let onPage = new array
    //now we find the lower limit and return that to 15
    //if its page 1 start at 0 otherwise do math
    let lower = 1
    if (data.page !== 1) {
      lower = (15 * (data.page - 1)) - 1
      onPage=results.slice(lower,lower+15)
    } else {
      //if its page 1 we need to write it slightly differently
      onPage=results.slice(0,15)
    }
    //now we send off all the fun bits of data to the command whuch actually changes the frontend
    res.locals.pages = (results.length/15).tofixed(0)
    res.locals.noOfRes = results.length
    res.locals.searchresults = onPage
    next()
  }

  //return search results with everything if theres no query given
  if (data.query == undefined) {
    model.allproducts(data,callback)
  } else {
    model.searchproducts(data,callback)
  }
  
};

module.exports.product = (req, res, next) => {
  const data = {
    id: req.params.id,
    uid:res.locals.userId
  }
  const callback = (err, results, fields) => {
    if (err) {
      console.error("error fetching listing", err)
      return res.status(500).json(err)
    }
    //if the product dosent exist redirect to a 404 page
    if (results.length = 0) {
      return res.status(404).json({body:"page not found"})
    }
    
    //and then we can do the normal stuff like getting all the info
    res.locals.info = results
    //parse them out into the actual data in the next step
    next()
  }
  model.product(data,callback)
}

module.exports.isOwner = (req, res, next) => {
  const data = {
    id: req.params.id,
    user: res.locals.userId
  }
  const callback = (err, results, fields) => {
    if (err) {
      console.error('problem checking ownership', err)
      return res.status(500).json(err)
    }
    if (results.owner_id == data.user) {
      res.locals.isOwner=true
    } else {
      res.locals.isOwner=false
    }
    next()
  }
  model.owner(data,callback)
}

module.exports.updateProduct = (req, res, next) => {
  const data = {
    toedit: req.params.id,
    newName: req.body.name,
    newPrice: req.body.price,
    newDesc:req.body.desc
  }
  //no way for them to be empty (autofill with old info + form validation)
  //check that its the right user otherwise dont let them update it (in theory they shouldnt even be able to get here)
  if (res.locals.isOwner == false) {
    return res.status(403).json({body:'you dont have permission to edit this listing'})
  }
  //now that we know theyre actually the owner we need to do the normal update stuff
  const callback = (err, results, fields) => {
    if (err) {
      console.error('problem updating listing', err)
      return res.status(500).json(err)
    }
    //this one dosent need to return anything, send along a success and then let the frontend have a popup that says updated sucessfully & refresh
    res.status(200).json()
  }
  model.updateProduct(data,callback)
}