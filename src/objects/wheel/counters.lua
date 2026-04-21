local C = require('src.objects.wheel.constants')

return function(PW)

function PW:setCounters(gold, tickets)
    if tickets < self._counterTickets then
        self._ticketShake.intensity = 3
        self._ticketShake.time = 0
    end
    if #self._goldAnims == 0 and not self._goldQuotaAnim then
        self._counterGold = gold
    end
    if #self._ticketFlyAnims == 0 and not self._ticketAnim then
        self._counterTickets = tickets
    end
end

function PW:startGoldFly(text, value, sx, sy, cx, cy)
    local cfg = C.GAUGE_CONFIGS[3]
    local MID_R = (self._rimR + 16 + self._rimR + 21) / 2
    local arcLen = cfg.eend - cfg.start
    local goldA = cfg.start + arcLen * 0.75
    self._goldAnims[#self._goldAnims+1] = {
        text = text, value = value,
        startX = sx, startY = sy,
        targetX = cx + math.cos(goldA) * MID_R,
        targetY = cy + math.sin(goldA) * MID_R,
        elapsed = 0, duration = 0.45, arrived = false,
    }
end

function PW:startTicketFly(text, value, sx, sy, cx, cy)
    local cfg = C.GAUGE_CONFIGS[3]
    local MID_R = (self._rimR + 16 + self._rimR + 21) / 2
    local arcLen = cfg.eend - cfg.start
    local tickA = cfg.start + arcLen * 0.25
    self._ticketFlyAnims[#self._ticketFlyAnims+1] = {
        text = text, value = value,
        startX = sx, startY = sy,
        targetX = cx + math.cos(tickA) * MID_R,
        targetY = cy + math.sin(tickA) * MID_R,
        elapsed = 0, duration = 0.45, arrived = false,
    }
end

function PW:startGoldQuotaAnim(quota)
    local cfg = C.GAUGE_CONFIGS[3]
    local MID_R = (self._rimR + 16 + self._rimR + 21) / 2
    local arcLen = cfg.eend - cfg.start
    local goldA = cfg.start + arcLen * 0.75
    self._goldQuotaAnim = {
        phase = 'fly', elapsed = 0,
        flyDur = 0.4, countDur = 0.8, holdDur = 0.6, flybackDur = 0.3,
        quota = quota, startGold = self._counterGold,
        fromA = goldA, fromMidR = MID_R,
    }
end

function PW:isGoldQuotaAnimDone() return not self._goldQuotaAnim end

function PW:startTicketAnim(earned)
    local cfg = C.GAUGE_CONFIGS[3]
    local MID_R = (self._rimR + 16 + self._rimR + 21) / 2
    local arcLen = cfg.eend - cfg.start
    local tickA = cfg.start + arcLen * 0.25
    self._ticketAnim = {
        phase = 'fly', elapsed = 0,
        flyDur = 0.4, countDur = 0.8, holdDur = 0.6, flybackDur = 0.3,
        earned = earned, counted = 0,
        baseTickets = self._counterTickets,
        fromA = tickA, fromMidR = MID_R,
    }
end

function PW:isTicketAnimDone() return not self._ticketAnim end

function PW:_updateCounters(dt)
    for i = #self._goldAnims, 1, -1 do
        local ga = self._goldAnims[i]
        ga.elapsed = ga.elapsed + dt
        if not ga.arrived and ga.elapsed >= ga.duration then
            ga.arrived = true
            self._counterGold = self._counterGold + ga.value
            self._goldShake.intensity = 3
            self._goldShake.time = 0
        end
        if ga.elapsed >= ga.duration + 0.15 then table.remove(self._goldAnims, i) end
    end

    for i = #self._ticketFlyAnims, 1, -1 do
        local ta = self._ticketFlyAnims[i]
        ta.elapsed = ta.elapsed + dt
        if not ta.arrived and ta.elapsed >= ta.duration then
            ta.arrived = true
            self._counterTickets = self._counterTickets + ta.value
            self._ticketShake.intensity = 3
            self._ticketShake.time = 0
        end
        if ta.elapsed >= ta.duration + 0.15 then table.remove(self._ticketFlyAnims, i) end
    end

    if self._goldQuotaAnim then
        local ga = self._goldQuotaAnim
        ga.elapsed = ga.elapsed + dt
        if ga.phase == 'fly' and ga.elapsed >= ga.flyDur then
            ga.phase = 'count'; ga.elapsed = 0
        elseif ga.phase == 'count' and ga.elapsed >= ga.countDur then
            ga.phase = 'hold'; ga.elapsed = 0
            self._counterGold = ga.startGold - ga.quota
        elseif ga.phase == 'hold' and ga.elapsed >= ga.holdDur then
            ga.phase = 'flyback'; ga.elapsed = 0
        elseif ga.phase == 'flyback' and ga.elapsed >= ga.flybackDur then
            self._goldQuotaAnim = nil
        end
        if ga and ga.phase == 'count' then
            local t = math.min(1, ga.elapsed / ga.countDur)
            self._counterGold = ga.startGold - math.floor(ga.quota * t)
        end
    end

    if self._ticketAnim then
        local ta = self._ticketAnim
        ta.elapsed = ta.elapsed + dt
        if ta.phase == 'fly' and ta.elapsed >= ta.flyDur then
            ta.phase = 'count'; ta.elapsed = 0
        elseif ta.phase == 'count' and ta.elapsed >= ta.countDur then
            ta.phase = 'hold'; ta.elapsed = 0
            ta.counted = ta.earned
            self._counterTickets = ta.baseTickets + ta.earned
        elseif ta.phase == 'hold' and ta.elapsed >= ta.holdDur then
            ta.phase = 'flyback'; ta.elapsed = 0
        elseif ta.phase == 'flyback' and ta.elapsed >= ta.flybackDur then
            self._ticketAnim = nil
        end
        if ta and ta.phase == 'count' then
            local t = math.min(1, ta.elapsed / ta.countDur)
            ta.counted = math.floor(ta.earned * t)
            self._counterTickets = ta.baseTickets + ta.counted
        end
    end
end

end
