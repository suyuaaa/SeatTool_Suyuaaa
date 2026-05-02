const storage = require('./storage');
const solver  = require('./solver');

Page({
  data: {
    currentView: 'home',
    classList: [],
    isEdit: false,
    editData: {
      className: '',
      N: 8,
      M: 7,
      students: [{ name: '', level: 1 }],
      dhGroups: [],
      occupied: [],
      podiumRect: [1, 1, 1, 1]      
    },
    currentClass: '',
    resultMatrix: [],
    loading: false
  },

  onLoad() {
    this.loadClassList();
  },

  
  switchView(e) {
    const view = e.currentTarget.dataset.view;
    const editName = e.currentTarget.dataset.edit;
    if (view === 'classList') {
      this.loadClassList();
      this.setData({ currentView: 'classList' });
    } else if (view === 'edit') {
      if (editName) {
        const data = storage.loadClass(editName);
        if (data) {
          this.setData({
            isEdit: true,
            currentView: 'edit',
            editData: {
              className: editName,
              N: data.N,
              M: data.M,
              students: data.points.map(p => ({ name: p[0], level: p[1] })),
              dhGroups: data.dh_groups.map(g => g.join(',')),
              occupied: data.lxly_occupied.map(p => ({ x: p[0], y: p[1] })),
              podiumRect: data.forbidden_rect || [1,1,1,1]
            }
          });
        }
      } else {
        this.setData({
          isEdit: false,
          currentView: 'edit',
          editData: {
            className: '',
            N: 8,
            M: 7,
            students: [{ name: '', level: 1 }],
            dhGroups: [],
            occupied: [],
            podiumRect: [1, 1, 1, 1]
          }
        });
      }
    } else if (view === 'home') {
      this.setData({ currentView: 'home' });
    } else if (view === 'tutorial') {
      this.setData({ currentView: 'tutorial' });
    }
  },

  
  loadClassList() {
    const list = wx.getStorageSync('classList') || [];
    this.setData({ classList: list });
  },
  onClassTap(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ currentClass: name, currentView: 'result' });
    setTimeout(() => this.startArrange(name), 100);
  },
  onClassLongPress(e) {
    const name = e.currentTarget.dataset.name;
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.switchView({ currentTarget: { dataset: { view: 'edit', edit: name } } });
        } else {
          wx.showModal({
            title: '确认删除',
            content: `确定要删除班级「${name}」吗？`,
            success: (modalRes) => {
              if (modalRes.confirm) {
                storage.deleteClass(name);
                this.loadClassList();
              }
            }
          });
        }
      }
    });
  },

  
  onEditField(e) {
    const field = e.currentTarget.dataset.field;
    let value = e.detail.value;
    if (field === 'N' || field === 'M') value = parseInt(value) || 0;
    this.setData({ [`editData.${field}`]: value });
  },

  onStudentName(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ [`editData.students[${idx}].name`]: e.detail.value });
  },
  onStudentLevel(e) {
    const idx = e.currentTarget.dataset.index;
    const val = parseFloat(e.detail.value) || 1;
    this.setData({ [`editData.students[${idx}].level`]: val });
  },
  addStudent() {
    this.data.editData.students.push({ name: '', level: 1 });
    this.setData({ editData: this.data.editData });
  },
  deleteStudent(e) {
    const idx = e.currentTarget.dataset.index;
    this.data.editData.students.splice(idx, 1);
    this.setData({ editData: this.data.editData });
  },

  onDhGroupInput(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ [`editData.dhGroups[${idx}]`]: e.detail.value });
  },
  addDhGroup() {
    this.data.editData.dhGroups.push('');
    this.setData({ editData: this.data.editData });
  },
  deleteDhGroup(e) {
    const idx = e.currentTarget.dataset.index;
    this.data.editData.dhGroups.splice(idx, 1);
    this.setData({ editData: this.data.editData });
  },

  onOccupiedInput(e) {
    const idx = e.currentTarget.dataset.index;
    const field = e.currentTarget.dataset.field;
    const val = parseInt(e.detail.value) || 0;
    this.setData({ [`editData.occupied[${idx}].${field}`]: val });
  },
  addOccupied() {
    this.data.editData.occupied.push({ x: 0, y: 0 });
    this.setData({ editData: this.data.editData });
  },
  deleteOccupied(e) {
    const idx = e.currentTarget.dataset.index;
    this.data.editData.occupied.splice(idx, 1);
    this.setData({ editData: this.data.editData });
  },

  
  saveClass() {
    const ed = this.data.editData;
    if (!ed.className.trim()) {
      wx.showToast({ title: '请输入班级名称', icon: 'none' });
      return;
    }
    const validStudents = ed.students.filter(s => s.name.trim());
    if (validStudents.length === 0) {
      wx.showToast({ title: '至少添加一名学生', icon: 'none' });
      return;
    }

    const points = validStudents.map(s => [s.name.trim(), s.level]);
    const dhGroupsArray = ed.dhGroups
      .filter(g => g.trim())
      .map(g => g.split(',').map(s => s.trim()).filter(s => s));
    const occupiedArray = ed.occupied
      .filter(p => p.x && p.y)
      .map(p => [p.x, p.y]);

    const classData = {
      students: validStudents.map(s => s.name.trim()),
      N: ed.N,
      M: ed.M,
      forbidden_rect: ed.podiumRect,
      points,
      dh_groups: dhGroupsArray,
      lxly_occupied: occupiedArray
    };

    storage.saveClass(ed.className.trim(), classData, this.data.isEdit ? ed.className : null);
    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => this.switchView({ currentTarget: { dataset: { view: 'classList' } } }), 1000);
  },

  
  startArrange(className) {
    const classData = storage.loadClass(className);
    if (!classData) {
      wx.showToast({ title: '班级数据不存在', icon: 'none' });
      return;
    }
    if (!classData.points || classData.points.length === 0) {
      wx.showToast({ title: '没有学生数据', icon: 'none' });
      return;
    }

    this.setData({ loading: true, resultMatrix: [] });
    wx.showLoading({ title: '计算中...', mask: true });

    setTimeout(() => {
      try {
        const history = storage.loadHistory(className) || [];
        const lxlySet = new Set(classData.lxly_occupied.map(p => p.join(',')));

        const matrix = solver.solve({
          N: classData.N,
          M: classData.M,
          forbiddenRect: classData.forbidden_rect,
          points: classData.points,
          dhGroups: classData.dh_groups,
          lxlyOccupiedSet: lxlySet,
          seed: Math.floor(Math.random() * 10000),
          history: history
        });

        this.setData({ resultMatrix: matrix, loading: false });
        wx.hideLoading();
        storage.saveHistory(className, matrix);
      } catch (e) {
        this.setData({ loading: false });
        wx.hideLoading();
        wx.showModal({ title: '排座出错', content: e.message, showCancel: false });
      }
    }, 50);
  },

  rearrange() {
    this.startArrange(this.data.currentClass);
  },

  showSettings() {
    wx.showModal({ title: '设置', content: '可调节算法参数（待开发）', showCancel: false });
  }
});