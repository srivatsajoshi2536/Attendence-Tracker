import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const STORAGE_KEY = '@attendance_data';

const App = () => {
  const [attendanceData, setAttendanceData] = useState({
    name: '',
    subjects: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Improved data loading with error handling
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setAttendanceData(JSON.parse(data));
      } else {
        setShowNamePrompt(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load attendance data');
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Improved data saving with error handling and optimistic updates
  const saveData = async (newData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      Alert.alert('Error', 'Failed to save data. Please try again.');
      setAttendanceData(attendanceData); // Revert to previous state
      console.error('Error saving data:', error);
    }
  };

  const handleNameSubmit = () => {
    if (!tempName.trim()) {
      Alert.alert('Error', 'Please enter a valid name');
      return;
    }
    const newData = { ...attendanceData, name: tempName.trim() };
    setAttendanceData(newData);
    saveData(newData);
    setShowNamePrompt(false);
    setTempName('');
  };

  // Improved percentage calculation with error handling
  const calculatePercentage = (present, absent) => {
    const total = present + absent;
    if (total === 0) return '0.00';
    const percentage = (present / total) * 100;
    return percentage.toFixed(2);
  };

  // Fixed total attendance calculation
  const calculateTotalAttendance = useCallback(() => {
    const totalPresent = attendanceData.subjects.reduce((sum, subject) => sum + subject.present, 0);
    const totalAbsent = attendanceData.subjects.reduce((sum, subject) => sum + subject.absent, 0);
    const totalClasses = totalPresent + totalAbsent;
    
    return {
      present: totalPresent,
      total: totalClasses,
      percentage: calculatePercentage(totalPresent, totalAbsent),
    };
  }, [attendanceData.subjects]);

  const handleAddSubject = () => {
    if (!newSubjectName.trim()) {
      Alert.alert('Error', 'Please enter a subject name');
      return;
    }

    // Check for duplicate subject names
    if (attendanceData.subjects.some(subject => 
      subject.name.toLowerCase() === newSubjectName.trim().toLowerCase())) {
      Alert.alert('Error', 'This subject already exists');
      return;
    }

    const newData = {
      ...attendanceData,
      subjects: [
        ...attendanceData.subjects,
        { name: newSubjectName.trim(), present: 0, absent: 0 },
      ],
    };
    setAttendanceData(newData);
    saveData(newData);
    setNewSubjectName('');
    setIsAddModalVisible(false);
  };

  const updateAttendance = useCallback((index, isPresent) => {
    const newSubjects = [...attendanceData.subjects];
    if (isPresent) {
      newSubjects[index].present += 1;
    } else {
      newSubjects[index].absent += 1;
    }
    const newData = { ...attendanceData, subjects: newSubjects };
    setAttendanceData(newData);
    saveData(newData);
  }, [attendanceData]);

  const deleteSubject = useCallback((index) => {
    Alert.alert(
      'Delete Subject',
      'Are you sure you want to delete this subject? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newSubjects = attendanceData.subjects.filter((_, i) => i !== index);
            const newData = { ...attendanceData, subjects: newSubjects };
            setAttendanceData(newData);
            saveData(newData);
          },
        },
      ]
    );
  }, [attendanceData]);

  const exportToCSV = async () => {
    if (attendanceData.subjects.length === 0) {
      Alert.alert('Error', 'No data to export');
      return;
    }

    const headers = 'Subject,Classes Attended,Classes Missed,Attendance Percentage\n';
    const rows = attendanceData.subjects
      .map(subject => 
        `${subject.name},${subject.present},${subject.absent},${calculatePercentage(
          subject.present,
          subject.absent
        )}%`
      )
      .join('\n');
    const csvContent = `${headers}${rows}`;

    const fileUri = `${FileSystem.documentDirectory}attendance_${Date.now()}.csv`;
    try {
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      Alert.alert('Error', 'Failed to export CSV file');
      console.error('Export error:', error);
    }
  };

  const filteredSubjects = attendanceData.subjects.filter(subject =>
    subject.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={showNamePrompt}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Welcome!</Text>
            <Text style={styles.modalSubtitle}>Please enter your name to continue</Text>
            <TextInput
              style={styles.modalInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
              maxLength={50}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalButton, !tempName.trim() && styles.disabledButton]}
              onPress={handleNameSubmit}
              disabled={!tempName.trim()}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Subject</Text>
            <TextInput
              style={styles.modalInput}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              placeholder="Enter subject name"
              placeholderTextColor="#9CA3AF"
              maxLength={50}
              autoFocus
            />
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setNewSubjectName('');
                  setIsAddModalVisible(false);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, !newSubjectName.trim() && styles.disabledButton]}
                onPress={handleAddSubject}
                disabled={!newSubjectName.trim()}
              >
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hello, {attendanceData.name}!</Text>
        <Text style={styles.headerSubtitle}>Track your attendance below</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search subjects..."
          placeholderTextColor="#A1A1AA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setIsAddModalVisible(true)}
        >
          <Text style={styles.buttonText}>Add Subject</Text>
        </TouchableOpacity>

        {attendanceData.subjects.length > 0 && (
          <View style={styles.totalAttendance}>
            <Text style={styles.totalTitle}>Total Attendance</Text>
            <Text style={styles.totalText}>
              {calculateTotalAttendance().present} classes attended out of{' '}
              {calculateTotalAttendance().total} total classes
            </Text>
            <Text style={styles.totalPercentage}>
              {calculateTotalAttendance().percentage}% attendance
            </Text>
          </View>
        )}

        {filteredSubjects.map((subject, index) => (
          <View key={index} style={styles.subjectCard}>
            <Text style={styles.subjectName}>{subject.name}</Text>
            <Text style={styles.subjectStats}>
              {subject.present} attended / {subject.present + subject.absent} total
            </Text>
            <Text style={styles.subjectPercentage}>
              {calculatePercentage(subject.present, subject.absent)}% attendance
            </Text>
            <View style={styles.subjectButtons}>
              <TouchableOpacity
                style={[styles.subjectButton, styles.presentButton]}
                onPress={() => updateAttendance(index, true)}
              >
                <Text style={styles.buttonText}>Present</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subjectButton, styles.absentButton]}
                onPress={() => updateAttendance(index, false)}
              >
                <Text style={styles.buttonText}>Absent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subjectButton, styles.deleteButton]}
                onPress={() => deleteSubject(index)}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {attendanceData.subjects.length === 0 && (
          <Text style={styles.noSubjectsText}>
            No subjects added yet. Tap "Add Subject" to get started!
          </Text>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={[styles.exportButton, attendanceData.subjects.length === 0 && styles.disabledButton]}
        onPress={exportToCSV}
        disabled={attendanceData.subjects.length === 0}
      >
        <Text style={styles.buttonText}>Export to CSV</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 20,
    backgroundColor: '#6366F1',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    marginVertical: 10,
  },
  searchInput: {
    backgroundColor: '#E5E7EB',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    color: '#374151',
  },
  content: {
    padding: 20,
  },
  addButton: {
    backgroundColor: '#10B981',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  totalAttendance: {
    backgroundColor: '#6366F1',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  totalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  totalText: {
    fontSize: 16,
    color: '#D1D5DB',
    marginVertical: 5,
  },
  totalPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  subjectStats: {
    fontSize: 14,
    color: '#6B7280',
    marginVertical: 5,
  },
  subjectPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  subjectButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  subjectButton: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  presentButton: {
    backgroundColor: '#10B981',
  },
  absentButton: {
    backgroundColor: '#F59E0B',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  noSubjectsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6B7280',
    marginTop: 20,
    fontStyle: 'italic',
  },
  exportButton: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#374151',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    color: '#374151',
  },
  modalButton: {
    backgroundColor: '#6366F1',
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#9CA3AF',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default App;