const posts = [

{
    studentNumber:"2510044",
    text:"この問題解けた人いる？",
    createdAt:"7/4 14:32",
    likeCount:0,
    commentCount:0
},

{
    studentNumber:"2510018",
    text:"今日の解剖のプリント持ってる人いますか？",
    createdAt:"7/4 12:08",
    likeCount:2,
    commentCount:1
}

];

const postList =
document.getElementById("postList");

posts.forEach(post=>{

postList.innerHTML += `

<div class="post-card">

<div class="post-header">

<div>

<div class="student-number">

👤 ${post.studentNumber}

</div>

<div class="post-time">

${post.createdAt}

</div>

</div>

</div>

<div class="post-text">

${post.text}

</div>

<div class="post-footer">

❤️ ${post.likeCount}

💬 ${post.commentCount}

</div>

</div>

`;

});