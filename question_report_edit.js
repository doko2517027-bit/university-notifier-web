import {db,studentNumber,isAdmin,showPage} from "./common.js";
import {doc,getDoc,setDoc,updateDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
const reportId=new URLSearchParams(location.search).get("reportId");
const questionInput=document.getElementById("editReportedQuestion"),choicesInput=document.getElementById("editReportedChoices"),answerNumber=document.getElementById("editReportedAnswerNumber"),answersInput=document.getElementById("editReportedAnswers"),explanationInput=document.getElementById("editReportedExplanation");
let report,publishedData,target,index=-1;
if(!await isAdmin()){alert("管理者のみ利用できます");location.replace("index.html")}
const lines=value=>String(value||"").split(/\r?\n/).map(item=>item.trim()).filter(Boolean);
async function load(){
    const reportSnap=await getDoc(doc(db,"reports",reportId||"missing"));
    if(!reportSnap.exists())throw new Error("通報が見つかりません");report=reportSnap.data();
    const [subjectSnap,unitSnap,publishedSnap]=await Promise.all([
        getDoc(doc(db,"examSubjects",report.subjectId)),
        getDoc(doc(db,"examSubjects",report.subjectId,"units",report.unitId)),
        getDoc(doc(db,"examSubjects",report.subjectId,"units",report.unitId,"publishedQuestions","published"))
    ]);
    if(!publishedSnap.exists())throw new Error("公開問題が見つかりません");publishedData=publishedSnap.data();
    const subjectName=subjectSnap.data()?.name||subjectSnap.data()?.subjectName||report.subjectId;
    const unitName=unitSnap.data()?.name||unitSnap.data()?.unitName||report.unitId;
    document.getElementById("questionLocation").textContent=`${subjectName} / ${unitName} / ${report.questionType||"問題"}`;
    if(report.questionType==="daily")target=publishedData.today_question;
    else{
        const key=report.questionType==="fillBlank"?"fill_blank":"quiz";const items=Array.isArray(publishedData[key])?publishedData[key]:[];
        index=items.findIndex((item,i)=>String(item.id??i)===String(report.questionId));
        if(index<0)index=items.findIndex(item=>String(item.question||"")===String(report.question||""));
        target=index>=0?items[index]:null;
    }
    if(!target)throw new Error("通報対象の問題を特定できません");
    questionInput.value=target.question||"";explanationInput.value=target.explanation||"";
    const fill=report.questionType==="fillBlank";
    document.getElementById("choicesField").hidden=fill;document.getElementById("answerNumberField").hidden=fill;document.getElementById("explanationField").hidden=fill;document.getElementById("answersField").hidden=!fill;
    if(fill)answersInput.value=(target.answers||[target.answer||""]).join("\n");
    else{choicesInput.value=(target.choices||[]).join("\n");answerNumber.value=Number(target.answer||0)+1}
}
document.getElementById("saveReportedQuestion").onclick=async()=>{
    if(!questionInput.value.trim()){alert("問題文を入力してください");return}
    const updated={...target,question:questionInput.value.trim()};
    if(report.questionType==="fillBlank"){
        const answers=lines(answersInput.value);if(!answers.length){alert("正解を入力してください");return}updated.answers=answers;updated.answer=answers.join("・");
    }else{
        const choices=lines(choicesInput.value),answer=Number(answerNumber.value)-1;if(choices.length<2||answer<0||answer>=choices.length){alert("選択肢と正解番号を確認してください");return}updated.choices=choices;updated.answer=answer;updated.explanation=explanationInput.value.trim();
    }
    const next={...publishedData};
    if(report.questionType==="daily")next.today_question=updated;else{const key=report.questionType==="fillBlank"?"fill_blank":"quiz";next[key]=[...(next[key]||[])];next[key][index]=updated}
    if(!confirm("修正内容を公開中の問題へ反映しますか？"))return;
    await Promise.all([
        setDoc(doc(db,"examSubjects",report.subjectId,"units",report.unitId,"publishedQuestions","published"),{...next,lastCorrectedAt:serverTimestamp(),lastCorrectedBy:studentNumber}),
        setDoc(doc(db,"examSubjects",report.subjectId,"units",report.unitId,"ai","edited"),{...next,lastCorrectedAt:serverTimestamp(),lastCorrectedBy:studentNumber},{merge:true}),
        updateDoc(doc(db,"reports",reportId),{status:"corrected",correctedAt:serverTimestamp(),correctedBy:studentNumber})
    ]);
    alert("問題を修正しました");location.replace("reports_admin.html?view=resolved");
};
document.getElementById("backButton").onclick=()=>history.length>1?history.back():location.replace("admin.html");
load().catch(error=>{console.error(error);alert(error.message);location.replace("admin.html")});showPage();
