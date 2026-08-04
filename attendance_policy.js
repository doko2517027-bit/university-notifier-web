export const PERIOD_TIMES = Object.freeze({
    1:{startTime:"09:00",endTime:"10:30"},2:{startTime:"10:40",endTime:"12:10"},
    3:{startTime:"13:00",endTime:"14:30"},4:{startTime:"14:40",endTime:"16:10"},
    5:{startTime:"16:20",endTime:"17:50"}
});

const minutes=value=>{const [h,m]=String(value||"").split(":").map(Number);return h*60+m};
const nowMinutes=date=>date.getHours()*60+date.getMinutes();
export function classifyArrival(date,startTime){const delta=nowMinutes(date)-minutes(startTime);return delta<=0?"出席":delta<=30?"遅刻":"欠席"}
export function classifyDeparture(date,endTime){const remaining=minutes(endTime)-nowMinutes(date);return remaining<=0?"退席":remaining<=30?"早退":"欠席"}
export function isArrivalWindowOpened(date,startTime){return nowMinutes(date)>=minutes(startTime)-10}
export function isDepartureWindow(date,endTime){const delta=nowMinutes(date)-minutes(endTime);return delta>=-5&&delta<=10}
export function slotId(scheduleId,date,period,subject){return `${scheduleId}_${date}_P${period}_${encodeURIComponent(subject)}`}
export function absenceUnits(record){return Math.min(1,(record.arrivalStatus==="欠席"?1:record.arrivalStatus==="遅刻"?1/3:0)+(record.departureStatus==="欠席"?1:record.departureStatus==="早退"?1/3:0))}
