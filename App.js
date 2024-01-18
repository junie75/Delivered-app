import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, Button } from "react-native";
import * as SQLite from "expo-sqlite";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
// import SQLite from "react-native-sqlite-storage";
// import { FileSystem } from "expo-file-system";

export default function App() {
  //database connection
  //making db a state variable bc it may be changed when importing/exporting
  const [db, setDb] = useState(SQLite.openDatabase("example.db"));
  const [isLoading, setIsLoading] = useState(true); //checks if data is loading, if not show data
  const [names, setNames] = useState([]); //for loaded names from database
  const [currentName, setCurrentName] = useState(undefined); //for user input of names

  //export database
  const exportDb = async () => {
    await Sharing.shareAsync(
      FileSystem.documentDirectory + "SQLite/example.db"
    );
  };

  //import database
  const importDb = async () => {
    let result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });

    //if document is successfully chosen, start import
    if (result.type === "success") {
      setIsLoading(true);

      //check if sqlite directory exists, if not make the directory
      if (
        !(
          await FileSystem.getInfoAsync(FileSystem.documentDirectory + "SQLite")
        ).exists
      ) {
        await FileSystem.makeDirectoryAsync(
          FileSystem.documentDirectory + "SQLite"
        );
      }

      //load base64 data from file
      const base64 = await FileSystem.readAsStringAsync(
        //specify uri based on what user selected
        result.uri,
        //set encoding as base64
        {
          encoding: FileSystem.EncodingType.Base64,
        }
      );

      //write as string so db file exists in known location
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + "SQLite/example.db",
        base64,
        { encoding: FileSystem.EncodingType.Base64 }
      );
      //close existing db
      await db.closeAsync();
      setDb(SQLite.openDatabase("example.db"));
    }
  };

  //use effect is run every time app reloads
  useEffect(() => {
    //create transaction and run sql on it
    db.transaction((tx) => {
      tx.executeSql(
        //create simple table with name and text as attributes
        "CREATE TABLE IF NOT EXISTS names" +
          "(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)"
      );
    });

    //select data from table
    db.transaction((tx) => {
      //null is the parameters, this is parameterized query to prevent injection attack
      tx.executeSql(
        "SELECT * FROM names",
        null,
        //success callback function
        (txObj, resultSet) => setNames(resultSet.rows._array), //setting the results as our names array
        //error callback function
        (txObj, error) => console.log(error) //logs if there are errors executing SQL
      );
    });

    setIsLoading(false); //at this stage names should be loaded
  }, [db]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading names...</Text>
      </View>
    );
  }
  //   {
  //     name: "Delivered-db",
  //     location: "default",
  //   },
  //   () => {
  //     console.log("Database connected");
  //   }, //on success
  //   (error) => console.log("Database error", error) //on error
  // );

  // useEffect(() => {
  //   createTable(); //call create table function here
  // });

  // //create table function
  // const createTable = () => {
  //   db.executeSql(
  //     "CREATE TABLE IF NOT EXISTS" +
  //       "Account" +
  //       "(ID INTEGER PRIMARY KEY AUTOINCREMENT, FName VARCHAR, LName, VARCHAR, Address VARCHAR, Email VARCHAR, Phone VARCHAR)",
  //     [],
  //     (result) => {
  //       console.log("Table created successfully");
  //     },
  //     (error) => {
  //       console.log("Create table error", error);
  //     }
  //   );
  // };
  const addName = () => {
    db.transaction((tx) => {
      //insert user inputted name into database
      //? means parameterized query
      tx.executeSql(
        "INSERT INTO names (name) values (?)",
        [currentName],

        //success callback function
        (txObj, resultSet) => {
          let existingNames = [...names]; //creating clone of names array
          existingNames.push({ id: resultSet.insertId, name: currentName }); //add new name to array
          setNames(existingNames); //set names as the same array plus newly added name
          setCurrentName(undefined); //resets current name to default value
        },
        //success error function
        (txObj, error) => console.log(error)
      );
    });
  };

  const deleteName = (id) => {
    db.transaction((tx) => {
      tx.executeSql(
        "DELETE FROM names WHERE id = ?",
        [id],
        (txObj, resultSet) => {
          //check if there are any rows affected before updating names array
          if (resultSet.rowsAffected > 0) {
            let existingNames = [...names].filter((name) => name.id !== id); //filter out name to delete
            setNames(existingNames);
            // setCurrentName(undefined);
          }
        },
        (txObj, error) => console.log(error)
      );
    });
  };

  const updateName = (id) => {
    db.transaction((tx) => {
      //updates database
      tx.executeSql(
        "UPDATE names SET name = ? WHERE id = ?",
        [currentName, id],
        //success callback function
        (txObj, resultSet) => {
          //if any rows are affected, change names array with the updated value
          if (resultSet.rowsAffected > 0) {
            let existingNames = [...names]; //create copy of names array
            //find the index of the tuple with the passed in ID
            const indexToUpdate = existingNames.findIndex(
              (name) => name.id === id
            );
            //change the name of the tuple with that ID to the name inputted by the user
            existingNames[indexToUpdate].name = currentName;
            //set names to the updated array
            setNames(existingNames);
            //set the user input back to default value
            setCurrentName(undefined);
          }
        },
        //error callback function
        (txObj, error) => console.log(error)
      );
    });
  };

  const showNames = () => {
    //map the names to a row
    return names.map((name, index) => {
      //builds list of components based off of array
      return (
        //for each name, create this component
        <View key={index} style={styles.row}>
          <Text>{name.name}</Text>
          <Button title="Delete" onPress={() => deleteName(name.id)} />
          <Button
            title="Update"
            onPress={() => updateName(name.id) /*console.log(name.id)*/}
          />
        </View>
      );
    });
  };
  return (
    <View style={styles.container}>
      <TextInput
        value={currentName}
        placeholder="name"
        onChangeText={setCurrentName}
      />
      <Button title="Add Name" onPress={addName} />
      {showNames()}
      <Button title="Export Db" onPress={exportDb} />
      <Button title="Import Db" onPress={importDb} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "space-between",
    margin: 8,
  },
});
