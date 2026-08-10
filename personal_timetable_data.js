import { db, studentNumber } from "./common.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { PERIOD_TIMES } from "./attendance_policy.js";

export function normalizeCourseName(value){
    return String(value||"").normalize("NFKC").toLowerCase()
        .replace(/[（(]含?日本国憲法[)）]/g,"")
        .replace(/[（(]対面[)）]/g,"")
        .replace(/[（(][ab]クラス[)）]/g,"")
        .replace(/[\s　・･]/g,"")
        .replace(/[()（）「」『』]/g,"");
}

function scheduleDocumentId(user){
    if(String(user.department||"").trim()==="看護学科") return "ns_yamate";
    if(String(user.major||"").includes("理学療法")) return "pt";
    if(String(user.major||"").includes("作業療法")) return "ot";
    return "";
}

export async function loadPersonalTimetableData(){
    if(!studentNumber) return {entries:[],enrolled:[],scheduleDocumentId:"",reason:"not_logged_in"};
    const [userSnap,enrollmentSnap]=await Promise.all([
        getDoc(doc(db,"users",studentNumber)),
        getDocs(collection(db,"users",studentNumber,"enrolledSubjects"))
    ]);
    const user=userSnap.data()||{};
    const selectedClassGroup=String(user.attendanceClassGroup||"").trim();
    const enrolled=enrollmentSnap.docs.map(item=>({id:item.id,...item.data()})).filter(item=>item.status!=="removed");
    const aliasToCourse=new Map();
    for(const course of enrolled){
        for(const alias of [course.name,course.subjectKey,course.subjectId,course.id]){
            const normalized=normalizeCourseName(alias);
            if(normalized) aliasToCourse.set(normalized,course);
        }
    }
    const scheduleId=scheduleDocumentId(user);
    if(!scheduleId) return {entries:[],enrolled,aliasToCourse,scheduleDocumentId:"",reason:"schedule_not_configured"};
    const scheduleSnap=await getDoc(doc(db,"schedule",scheduleId));
    if(!scheduleSnap.exists()) return {entries:[],enrolled,aliasToCourse,scheduleDocumentId:scheduleId,reason:"schedule_missing"};
    const data=scheduleSnap.data();
    const days=Array.isArray(data.allDays)&&data.allDays.length
        ? data.allDays
        : Array.isArray(data.days)&&data.days.length?data.days:[
        {date:"",title:data.todayTitle||"今日",label:data.todayLabel||"",schedules:data.today||[]},
        {date:"",title:data.nextTitle||"次回",label:data.nextLabel||"",schedules:data.next||[]}
    ];
    const grade=String(user.grade||localStorage.getItem("grade")||"").normalize("NFKC").replace("年","").trim();
    const entries=[];
    for(const day of days){
        for(const item of Array.isArray(day.schedules)?day.schedules:[]){
            if(selectedClassGroup&&item.classGroup&&String(item.classGroup).trim()!==selectedClassGroup)continue;
            if(grade&&String(item.grade||"").normalize("NFKC").replace("年","").trim()!==grade) continue;
            const course=aliasToCourse.get(normalizeCourseName(item.subject));
            if(!course) continue;
            entries.push({
                entryId:`${scheduleId}_${day.date||day.title||"day"}_${item.period||"0"}_${course.id}`,
                sourceScheduleDocumentId:scheduleId,
                date:day.date||"",
                dayTitle:day.title||day.label||"講義日",
                dayLabel:day.label||"",
                period:Number.parseInt(item.period,10)||0,
                startTime:item.startTime||PERIOD_TIMES[Number.parseInt(item.period,10)]?.startTime||"",
                endTime:item.endTime||PERIOD_TIMES[Number.parseInt(item.period,10)]?.endTime||"",
                subjectId:course.subjectId||course.id,
                subjectKey:course.subjectKey||course.name||course.id,
                subject:course.name||item.subject,
                scheduleSubject:item.subject||"",
                classGroup:item.classGroup||"",
                teacher:item.teacher||"",
                building:item.building||"",
                room:item.room||"",
                isPractical:course.isPractical===true,
                isRetake:course.isRetake===true || course.creditStatus==="not_earned",
                lectureCount:Number(course.lectureCount||0),
                credits:Number(course.credits||0)
            });
        }
    }
    entries.sort((a,b)=>(a.date||"").localeCompare(b.date||"")||a.period-b.period);
    return {entries,enrolled,aliasToCourse,scheduleDocumentId:scheduleId,reason:entries.length?"ok":"no_matches"};
}

export function isEnrolledScheduleItem(item,aliasToCourse){
    return Boolean(aliasToCourse?.get(normalizeCourseName(item?.subject)));
}
