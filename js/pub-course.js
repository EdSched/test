// pub-course.js —— 课程安排发布（完整版：使用英文key）
document.addEventListener('DOMContentLoaded', () => {
  const rootSel = '#pub-course [data-module="publish-course"]';

  // 事件委托，确保无论折叠/加载顺序如何都能绑定到发布按钮
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest(`${rootSel} .btn.btn-primary`);
    if (!btn) return;

    try {
      const root = document.querySelector(rootSel);
      if (!root) return alert('未找到发布表单');

      // fieldset 顺序：0=基本信息，1=时间与重复，2=上课形式与地点，3=讲义/备注
      const sets = root.querySelectorAll('fieldset');
      const fs1 = sets[0], fs2 = sets[1], fs3 = sets[2], fs4 = sets[3];
      if (!fs1 || !fs2) return alert('表单不完整，请刷新页面');

      // —— 基本信息 —— //
      const courseName = fs1.querySelector('input[placeholder="例如：社会学专业课"]')?.value.trim() || '';
      const teacher    = fs1.querySelector('input[placeholder="老师姓名或ID"]')?.value.trim() || '';
      const selects1   = fs1.querySelectorAll('select');
      const courseAttr = selects1[0]?.value || '';
      const scheduleStatus = selects1[selects1.length - 1]?.value || ''; // 最后一个select是课程状态

      // —— DOM 元素统一获取 —— //
      const depSel = document.getElementById('pubDepartment');
      const majorSel = document.getElementById('pubMajor');
      const studentInput = fs1.querySelector('input[placeholder="学生姓名或ID"]');

      // —— M列（面向专业）规则 —— //
      let M = [];
      const dep = (depSel?.value || '').trim();
      
      if (dep === '全部') {
        M = ['全部'];
      } else if (!dep) {
        M = []; // 不选所属：M为空
      } else {
        // 选了文科/理科
        const selectedMajors = majorSel && !majorSel.disabled
          ? Array.from(majorSel.selectedOptions).map(o => o.value).filter(Boolean)
          : [];
        
        if (selectedMajors.length > 0) {
          M = selectedMajors; // 选了具体专业
        } else {
          M = [dep]; // 选了文科/理科但未选专业：写所属大学院名
        }
      }

      // —— N列（可见学生IDs）规则 —— //
      let N = [];
      const studentRaw = studentInput?.value.trim() || '';
      if (studentRaw) {
        N = studentRaw.split(/[,\s，、]+/).map(s => s.trim()).filter(Boolean);
      }

      // —— 时间与重复 —— //
      const dates = fs2.querySelectorAll('input[type="date"]');
      const singleDate = dates[0]?.value || '';
      const rangeStart = dates[1]?.value || '';
      const rangeEnd = dates[2]?.value || '';
      const dateRange = (rangeStart && rangeEnd) ? `${rangeStart}~${rangeEnd}` : '';

      const weekdays = fs2.querySelector('input[placeholder="如：一,三,五"]')?.value.trim() || '';
      const countStr = fs2.querySelector('input[type="number"]')?.value || '';
      const count = countStr ? Number(countStr) : null;

      const times = fs2.querySelectorAll('input[type="time"]');
      const startTime = times[0]?.value || '';
      const endTime = times[1]?.value || '';
      const breakMins = fs2.querySelector('input[placeholder="如：10分钟（可选）"]')?.value.trim() || '';

      // —— 上课形式与地点 —— //
      const selects3 = fs3?.querySelectorAll('select') || [];
      const classMode = selects3[0]?.value || '';
      const campus = selects3[1]?.value || '';
      const classroom = fs3?.querySelector('input[placeholder="如：A-301"]')?.value.trim() || '';
      const onlineLink = fs3?.querySelector('input[placeholder="https://..."]')?.value.trim() || '';

      // —— 讲义/备注 —— //
      const handoutUrl = fs4?.querySelector('input[placeholder="可填链接或简单备注"]')?.value.trim() || '';

      // —— 校验 —— //
      const err = (m) => alert(m);
      const hasRange = !!(rangeStart && rangeEnd);
      const hasSingle = !!singleDate;
      
      if (!courseAttr) return err('请选择课程属性');
      if (!courseName) return err('请填写课程名');
      if (!teacher) return err('请填写任课老师');
      if (!(hasSingle || hasRange)) return err('请选择单回日期或填写复数区间');
      if (!startTime || !endTime) return err('请填写开始/结束时间');
      if (!scheduleStatus) return err('请选择课程状态');
      
      // 关键校验：仅当 M 与 N 同时为空时阻止发布
      if (M.length === 0 && N.length === 0) {
        return err('请选择"发布对象所属/专业"，或填写"学生姓名或ID"。两者不能同时为空。');
      }

      // 调试日志
      console.log('📝 课程发布数据收集:');
      console.log('所属:', dep);
      console.log('多选专业:', majorSel ? Array.from(majorSel.options).map(o => ({value: o.value, selected: o.selected, text: o.textContent})) : 'majorSel不存在');
      console.log('处理后的M:', M);
      console.log('处理后的N:', N);

      // —— 组装 payload（使用英文脚本key） —— //
      const payload = {
        coursename: courseName,
        attr: courseAttr,
        teacher: teacher,
        singledate: singleDate,
        daterange: dateRange,
        weekdays: weekdays,
        count: count,
        starttime: startTime,
        endtime: endTime,
        majors: M.join(','),              // 数组转字符串
        visiblestudentids: N.join(','),   // 数组转字符串
        classmode: classMode,
        campus: campus,
        classroom: classroom,
        onlinelink: onlineLink,
        handouturl: handoutUrl,
        coursestatus: scheduleStatus,
        breakmins: breakMins
      };

      console.log('🚀 发送到后端的payload:', payload);

      // —— 调用后端 —— //
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = '发布中…';
      
      try {
        const res = await callAPI('publishCourse', payload);
        
        console.log('📡 后端返回结果:', res);
        
        if (res && res.success) {
          alert('课程发布成功！');
          
          // 清空表单
          clearForm(root);
          
          // 刷新日历
          try { 
            window.calendar && window.calendar.refetchEvents && window.calendar.refetchEvents(); 
          } catch (e) {
            console.log('日历刷新失败:', e);
          }
        } else {
          const errorMsg = '发布失败：' + (res && res.message ? res.message : '未知错误');
          alert(errorMsg);
          console.error('发布失败，后端返回:', res);
        }
      } catch (apiError) {
        alert('网络请求失败：' + apiError.message);
        console.error('API调用异常:', apiError);
      }
      
    } catch (e) {
      alert('脚本异常：' + (e && e.message ? e.message : e));
      console.error('脚本异常:', e);
    } finally {
      // 确保按钮状态恢复
      btn.disabled = false;
      btn.textContent = oldText || '发布';
    }
  });

  // 清空表单的辅助函数
  function clearForm(root) {
    try {
      // 清空所有输入框
      root.querySelectorAll('input').forEach(input => {
        if (input.type !== 'submit' && input.type !== 'button') {
          input.value = '';
        }
      });
      
      // 重置所有下拉框
      root.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
        // 清空多选的选中状态
        Array.from(select.options).forEach(option => {
          option.selected = false;
        });
      });
      
      // 清空文本域
      root.querySelectorAll('textarea').forEach(textarea => {
        textarea.value = '';
      });
      
      console.log('✅ 表单已清空');
    } catch (e) {
      console.warn('表单清空失败:', e);
    }
  }
});
