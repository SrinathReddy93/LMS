const http = require("http")
let books = require("./bookDb");
let members = require("./member");
const port = 3100;
console.log('books', books);
console.log('members', members);

http.createServer(function (req, res) {
    let url = req.url;
    if(req.method == 'POST') {
       var body = '';
       req.on('data', function (data) {
           body += data;
       });
       req.on('end', function () {
           if(body.length == 0) {
               res.writeHead(400, { 'Content-Type': 'application/json' });
               let rtn = JSON.stringify({success:0, message:'wrong data, please check your body.'});
               res.end(rtn)
               return;
           } 
           body = JSON.parse(body);
           if(url != '/addMember'){
                if(!body.hasOwnProperty("member_id")) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    let rtn = JSON.stringify({success:0, message:'wrong data, please send member_id in body'});
                    res.end(rtn);
                    return;
                }
                let is_present = checkMemberId(body.member_id);
                if(is_present === undefined) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    let rtn = JSON.stringify({success:0, message:'wrong member_id, first add to LMS, by callaing /addMember'});
                    res.end(rtn);
                    return;
                }
           }
           if(url ==='/addMember'){
               res.setHeader('Content-Type', 'application/json');
               let id = members[members.length-1].id + 1;
               let member = {
                   name: body.name,
                   id,
                   borrowed_book:[]
               }
               members.push(member);
               let rtn = JSON.stringify(members);
               res.end(rtn);
           } else if(url ==='/bookSearch'){
               if(!body.hasOwnProperty("name")) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                let rtn = JSON.stringify({success:0, message:'wrong data, please send name in body'});
                res.end(rtn);
                return;
               }
               res.setHeader('Content-Type', 'application/json');
               let rtn = JSON.stringify(bookSearch(body.name));
               res.end(rtn);
           } else if(url ==='/borrow_book'){
              if(!body.hasOwnProperty("book_uid")) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                let rtn = JSON.stringify({success:0, message:'wrong data, please send book_uid in body'});
                res.end(rtn);
                return;
               }
               res.setHeader('Content-Type', 'application/json');
               let rtn = JSON.stringify(borrowBook({uid:body.book_uid, member_id:body.member_id }));
               res.end(rtn);
           } else if(url ==='/return_book'){
                if(!body.hasOwnProperty("book_uid")) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    let rtn = JSON.stringify({success:0, message:'wrong data, please send book_uid in body'});
                    res.end(rtn);
                    return;
                }
                removeBookInMember({uid:body.book_uid, member_id:body.member_id });
                removeMemberInBook({uid:body.book_uid, member_id:body.member_id });
                res.setHeader('Content-Type', 'application/json');
                let rtn = JSON.stringify({success:1, message:'book returned successfully.'});
                res.end(rtn);
           } else if(url ==='/reserva_book'){
                if(!body.hasOwnProperty("book_uid")) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    let rtn = JSON.stringify({success:0, message:'wrong data, please send book_uid in body'});
                    res.end(rtn);
                    return;
                }
               res.setHeader('Content-Type', 'application/json');
               let rtn = JSON.stringify(reservaBook({uid:body.book_uid, member_id:body.member_id }));
               res.end(rtn);
           } else if(url ==='/cancele_reserva_book'){
               res.setHeader('Content-Type', 'application/json');
               let rtn = JSON.stringify(cancelReservaBook({uid:body.book_uid, member_id:body.member_id }));
               res.end(rtn);
           } else if(url ==='/search_book_checkout'){
               let rtn = {};
               if(body.hasOwnProperty("name")) {
                 rtn["book"]= search_book({name:body.name, member_id:body.member_id});                   
               }
               if(body.hasOwnProperty("checkout")) {
                 rtn["checkout_book"] = search_book_checkout({checkout:body.checkout, member_id:body.member_id});
               }               
               res.setHeader('Content-Type', 'application/json');
               res.end(JSON.stringify({success:1, data:rtn}));
           }
       });
   } else if(req.method == "GET") {
    if(url === '/getMember') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        let rtn = JSON.stringify({success:1, members});
        res.end(rtn);
        return;
    } 
    if(url === '/getBooks') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        let rtn = JSON.stringify({success:1, books});
        res.end(rtn);
        return;
    } 
   }
   
   }).listen(port, function() {
    console.log("server start at port 3100");
});

const checkMemberId = (id) => {    
    const found = members.find(member => member.id == id);
    return found;
}

const bookSearch = (name) => {  
    const book = books.filter( book => book.name === name);
    return book.length > 0 ? {success:1, book} : {success:0, message:'book not found.'}
}

const borrowBook = (obj) => {  
    let {uid, member_id} = {...obj}
    if(members[member_id-1].borrowed_book.length >= 5) {
        return { success:0, message:"you reached max book borrow count."}
    }
    const book_index = books.findIndex( book => {
        return book.uid === uid;
    });
    if(book_index == -1) {
        return {success:0, message:'book not available in library.'};
    }    

    if(books[book_index].available_copies > 0) {
        // check for book already borrowed by same user or not
        books[book_index].available_copies -= 1;
        var dt = new Date();
        dt.setDate(dt.getDate() + 14);
        books[book_index].borrow_member.push({
            member_id,
            expected_return: dt 
        })
        addBookToMember({member_id,expected_return:dt, name:books[book_index].name, uid: books[book_index].uid})
        return { success:1, book:books[book_index]}
    } else {
        return {success:0, message:'book not available now, please reserve book by calling /reserveBook.'}
    }
}

const addBookToMember = (obj) => {  
    let {member_id, name, uid, expected_return} = {...obj};
    const index = members.findIndex(member => member.id == member_id);
    members[index].borrowed_book.push({
        book_name:name,
        uid,
        expected_return
    });
    const book = books.filter( book => book.name === name);
    return book.length > 0 ? {success:1, book} : {success:0, message:'book not found.'}
}

const search_book = (obj) => {
    let {member_id, name} = {...obj};
    const member = members[member_id-1].borrowed_book.filter(member => member.book_name === name);
    return member;
}

const search_book_checkout = (obj) => {
    let {member_id, checkout} = {...obj};
    let search_date = new Date(checkout);
    const member = members[member_id-1].borrowed_book.filter(member => {
        let member_date = new Date(member.expected_return);
        return (member_date.getFullYear() === search_date.getFullYear() && member_date.getDay() === search_date.getDay() && member_date.getMonth() === search_date.getMonth())
    });
    return member;
}

const removeBookInMember = (obj) => {  
    let {member_id, uid} = {...obj};
    const index = members.findIndex(member => member.id == member_id); // check book is not present in member.
    let borrowed_book = members[index].borrowed_book.filter(book => book.uid !== uid);
    members[index].borrowed_book = borrowed_book ? borrowed_book : [];
    return true;
}

const removeMemberInBook = (obj) => {  
    let {member_id, uid} = {...obj};
    const index = books.findIndex(book => book.uid == uid); // check member is not present in book.
    books[index].available_copies += 1;
    let borrow_member = books[index].borrow_member.filter(book => book.member_id !== member_id);
    books[index].borrow_member = borrow_member ? borrow_member : [];
    return true;
}

const reservaBook = (obj) => {
    let {member_id, uid} = {...obj};
    const index = books.findIndex(book => book.uid == uid);
    if(index == -1) return {success:0, message:'please check the book id'}
    if(books[index].reservation.indexOf(member_id)>-1) {
        return {success:0, message:'you already reserved the same book.'}
    } else {
        books[index].reservation.push(member_id);
        return {success:1, message:'book reserved successfully.'}
    }
}

const cancelReservaBook = (obj) => {
    let {member_id, uid} = {...obj};
    const index = books.findIndex(book => book.uid == uid);
    if(index == -1) return {success:0, message:'please check the book id'}

    if(books[index].reservation.indexOf(member_id)>-1) {
        let arr = books[index].reservation.filter(member => member !== member_id)
        books[index].reservation = arr;
        return {success:1, message:'book reservation is canceled.'}
    } else {
        books[index].reservation.push(member_id);
        return {success:0, message:'book is not reserved.'}
    }
}