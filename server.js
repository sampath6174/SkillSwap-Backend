const express = require("express");
const cors = require("cors");
const app = express();
const db = require("./db");

app.use(cors());
app.use(express.json());


// HOME
app.get("/", (req, res) => {
  res.send("<h1>SkillSwap TEST</h1>");
});


// REGISTER
app.post("/users", (req, res) => {

  const { name, email, password } = req.body;

  const sql = `
        INSERT INTO users (name, email, password)
        VALUES (?, ?, ?)
    `;

  db.query(sql, [name, email, password], (err, result) => {

    if (err) {

      console.log(err);

      res.status(500).json({
        message: "Email is already linked with another account",
      });

    } else {

      res.status(201).json({
        message: "User created successfully",
        userId: result.insertId,
      });

    }

  });

});


// LOGIN
app.post("/login", (req, res) => {

  const { email, password } = req.body;

  const sql = `
        SELECT * FROM users
        WHERE email = ?
    `;

  db.query(sql, [email], (err, result) => {

    console.log(result, "sql result.......");

    if (err) {

      console.log(err);

      res.status(500).json({
        message: "internal server error",
      });

    } else {

      if (result.length === 0) {

        res.status(401).json({
          message: "invalid email or password",
        });

      } else {

        if (result[0].password === password) {

          res.status(200).json({
            message: "Login successful",
            user: {
              id: result[0].id,
              name: result[0].name,
              email: result[0].email,
            },
          });

        } else {

          res.status(401).json({
            message: "invalid password",
          });

        }

      }

    }

  });

});


// GET SINGLE USER
app.get("/users/:id", (req, res) => {

  const userId = req.params.id;

  const sql = `
        SELECT id, name, email, bio, teach_skills, learn_skills
        FROM users
        WHERE id = ?
    `;

  db.query(sql, [userId], (err, result) => {

    if (err) {

      console.log(err);

      return res.status(500).json({
        message: "Internal server error",
      });

    }


    if (result.length === 0) {

      return res.status(404).json({
        message: "User not found",
      });

    }


    res.status(200).json({
      user: result[0],
    });

  });

});


// UPDATE PROFILE
app.put("/users/:id", (req, res) => {

  const userId = req.params.id;

  const {
    name,
    bio,
    teach_skills,
    learn_skills
  } = req.body;


  const sql = `
        UPDATE users
        SET
            name = ?,
            bio = ?,
            teach_skills = ?,
            learn_skills = ?
        WHERE id = ?
    `;


  db.query(
    sql,
    [name, bio, teach_skills, learn_skills, userId],
    (err, result) => {

      if (err) {

        console.log(err);

        return res.status(500).json({
          message: "Failed to update profile",
        });

      }


      res.status(200).json({
        message: "Profile updated successfully",
      });

    },
  );

});


// GET ALL USERS
app.get("/users", (req, res) => {

  const sql = `
        SELECT id, name, email, bio, teach_skills, learn_skills
        FROM users
    `;


  db.query(sql, (err, result) => {

    if (err) {

      console.log(err);

      return res.status(500).json({
        message: "Internal server error",
      });

    }


    res.status(200).json({
      users: result,
    });

  });

});


// SEND CONNECTION REQUEST
app.post("/connections", (req, res) => {

  const { sender_id, receiver_id } = req.body;


  // Check if a connection already exists
  const checkSql = `
        SELECT id, status
        FROM connections
        WHERE
            (sender_id = ? AND receiver_id = ?)
            OR
            (sender_id = ? AND receiver_id = ?)
        ORDER BY id DESC
        LIMIT 1
    `;


  db.query(
    checkSql,
    [sender_id, receiver_id, receiver_id, sender_id],
    (err, result) => {

      if (err) {

        console.log(err);

        return res.status(500).json({
          message: "Failed to check connection",
        });

      }


      // Connection already exists
      if (result.length > 0) {

        const existingConnection = result[0];


        if (existingConnection.status === "pending") {

          return res.status(400).json({
            message: "Connection request already sent",
          });

        }


        if (existingConnection.status === "accepted") {

          return res.status(400).json({
            message: "You are already connected",
          });

        }


        if (existingConnection.status === "rejected") {

          return res.status(400).json({
            message: "Connection request was rejected",
          });

        }

      }


      // Get sender name
      const senderSql = `
        SELECT name
        FROM users
        WHERE id = ?
      `;


      db.query(
        senderSql,
        [sender_id],
        (senderError, senderResult) => {

          if (senderError) {

            console.log(senderError);

            return res.status(500).json({
              message: "Failed to get sender",
            });

          }


          const senderName =
            senderResult.length > 0
              ? senderResult[0].name
              : "Someone";


          // Create new connection request
          const insertSql = `
            INSERT INTO connections (sender_id, receiver_id)
            VALUES (?, ?)
          `;


          db.query(
            insertSql,
            [sender_id, receiver_id],
            (err, result) => {

              if (err) {

                console.log(err);

                return res.status(500).json({
                  message: "Failed to send connection request",
                });

              }


              // Create notification for receiver
              const notificationSql = `
                INSERT INTO notifications (user_id, message)
                VALUES (?, ?)
              `;


              db.query(
                notificationSql,
                [
                  receiver_id,
                  `${senderName} sent you a new connection request`
                ],
                (notificationError) => {

                  if (notificationError) {

                    console.log(
                      "Notification error:",
                      notificationError
                    );

                    return res.status(500).json({
                      message:
                        "Connection created but notification failed",
                    });

                  }


                  // Send response only after
                  // notification is successfully created
                  res.status(201).json({
                    message: "Connection request sent successfully",
                    connectionId: result.insertId,
                  });

                }
              );

            }
          );

        }
      );

    }
  );

});


// GET CONNECTION REQUESTS
app.get("/connections/:userId", (req, res) => {

  const userId = req.params.userId;

  const sql = `
        SELECT
            connections.id,
            connections.sender_id,
            connections.receiver_id,
            connections.status,
            connections.created_at,
            users.name,
            users.email
        FROM connections
        JOIN users
            ON connections.sender_id = users.id
        WHERE
            connections.receiver_id = ?
            AND connections.status = 'pending'
    `;


  db.query(sql, [userId], (err, result) => {

    if (err) {

      console.log(err);

      return res.status(500).json({
        message: "Failed to fetch connection requests",
      });

    }


    res.status(200).json({
      requests: result,
    });

  });

});


// ACCEPT / REJECT CONNECTION REQUEST
app.put("/connections/:id", (req, res) => {

  const connectionId = req.params.id;
  const { status } = req.body;


  // Get the sender of the connection request
  const getConnectionSql = `
        SELECT sender_id
        FROM connections
        WHERE id = ?
    `;


  db.query(
    getConnectionSql,
    [connectionId],
    (err, result) => {

      if (err) {

        console.log(err);

        return res.status(500).json({
          message: "Failed to find connection request",
        });

      }


      if (result.length === 0) {

        return res.status(404).json({
          message: "Connection request not found",
        });

      }


      const senderId = result[0].sender_id;


      // Update connection status
      const updateSql = `
                UPDATE connections
                SET status = ?
                WHERE id = ?
            `;


      db.query(
        updateSql,
        [status, connectionId],
        (err, result) => {

          if (err) {

            console.log(err);

            return res.status(500).json({
              message: "Failed to update connection request",
            });

          }


          // If request was accepted,
          // create notification for the sender
          if (status === "accepted") {

            // Get receiver name
            const receiverSql = `
                SELECT name
                FROM users
                WHERE id = (
                    SELECT receiver_id
                    FROM connections
                    WHERE id = ?
                )
            `;


            db.query(
              receiverSql,
              [connectionId],
              (receiverError, receiverResult) => {

                if (receiverError) {

                  console.log(receiverError);

                }


                const receiverName =
                  receiverResult.length > 0
                    ? receiverResult[0].name
                    : "Someone";


                const notificationSql = `
                    INSERT INTO notifications (user_id, message)
                    VALUES (?, ?)
                `;


                db.query(
                  notificationSql,
                  [
                    senderId,
                    `${receiverName} accepted your connection request`
                  ],
                  (notificationError) => {

                    if (notificationError) {

                      console.log(
                        "Notification error:",
                        notificationError
                      );

                    }

                  }
                );

              }
            );

          }


          res.status(200).json({
            message: `Connection request ${status}`,
          });

        }
      );

    }
  );

});


// GET MY CONNECTIONS
app.get("/connections/user/:userId", (req, res) => {

  const userId = req.params.userId;

  const sql = `
        SELECT
            connections.id,
            users.id AS user_id,
            users.name,
            users.email,
            users.bio,
            users.teach_skills,
            users.learn_skills
        FROM connections
        JOIN users
            ON connections.receiver_id = users.id
        WHERE
            connections.sender_id = ?
            AND connections.status = 'accepted'

        UNION ALL

        SELECT
            connections.id,
            users.id AS user_id,
            users.name,
            users.email,
            users.bio,
            users.teach_skills,
            users.learn_skills
        FROM connections
        JOIN users
            ON connections.sender_id = users.id
        WHERE
            connections.receiver_id = ?
            AND connections.status = 'accepted'
    `;


  db.query(
    sql,
    [userId, userId],
    (err, result) => {

      if (err) {

        console.log(err);

        return res.status(500).json({
          message: "Failed to fetch connections",
        });

      }


      res.status(200).json({
        connections: result,
      });

    }
  );

});


// GET CONNECTION STATUS
app.get("/connections/status/:userId", (req, res) => {

  const userId = req.params.userId;
  const otherUserId = req.query.otherUserId;

  const sql = `
        SELECT id, sender_id, receiver_id, status
        FROM connections
        WHERE
            (
                sender_id = ?
                AND receiver_id = ?
            )
            OR
            (
                sender_id = ?
                AND receiver_id = ?
            )
        ORDER BY id DESC
        LIMIT 1
    `;


  db.query(
    sql,
    [userId, otherUserId, otherUserId, userId],
    (err, result) => {

      if (err) {

        console.log(err);

        return res.status(500).json({
          message: "Failed to get connection status",
        });

      }


      if (result.length === 0) {

        return res.status(200).json({
          status: "none",
        });

      }


      res.status(200).json({
        status: result[0].status,
        connection: result[0],
      });

    }
  );

});


// GET NOTIFICATIONS
app.get("/notifications/:userId", (req, res) => {

  const userId = req.params.userId;

  const sql = `
        SELECT
            id,
            message,
            is_read,
            created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY id DESC
    `;


  db.query(
    sql,
    [userId],
    (err, result) => {

      if (err) {

        console.log(err);

        return res.status(500).json({
          message: "Failed to fetch notifications",
        });

      }


      res.status(200).json({
        notifications: result,
      });

    }
  );

});


// MARK NOTIFICATIONS AS READ
app.put("/notifications/:userId/read", (req, res) => {

  const userId = req.params.userId;

  const sql = `
        UPDATE notifications
        SET is_read = 1
        WHERE user_id = ?
    `;


  db.query(
    sql,
    [userId],
    (err, result) => {

      if (err) {

        console.log(err);

        return res.status(500).json({
          message: "Failed to mark notifications as read",
        });

      }


      res.status(200).json({
        message: "Notifications marked as read",
      });

    }
  );

});

app.post("/skill-swaps", (req, res) => {

    const {
        user1_id,
        user2_id,
        skill1,
        skill2
    } = req.body;

    const sql = `
        INSERT INTO skill_swaps
        (user1_id, user2_id, skill1, skill2)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [user1_id, user2_id, skill1, skill2],
        (err, result) => {

            if (err) {
                console.log(err);

                return res.status(500).json({
                    message: "Failed to create skill swap"
                });
            }

            res.status(201).json({
                message: "Skill swap created successfully",
                swapId: result.insertId
            });

        }
    );
});

app.get("/skill-swaps/:userId", (req, res) => {

    const userId = req.params.userId;

    const sql = `
        SELECT *
        FROM skill_swaps
        WHERE user1_id = ? OR user2_id = ?
        ORDER BY id DESC
    `;

    db.query(
        sql,
        [userId, userId],
        (err, result) => {

            if (err) {
                console.log(err);

                return res.status(500).json({
                    message: "Failed to fetch skill swaps"
                });
            }

            res.status(200).json({
                swaps: result
            });

        }
    );
});

// SEND MESSAGE

app.post("/messages", (req, res) => {

    const {
        sender_id,
        receiver_id,
        message
    } = req.body;

    if (!sender_id || !receiver_id || !message) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

    const sql = `
        INSERT INTO messages
        (sender_id, receiver_id, message)
        VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [sender_id, receiver_id, message],
        (err, result) => {

            if (err) {
                console.log(err);

                return res.status(500).json({
                    message: "Failed to send message"
                });
            }

            res.status(201).json({
                message: "Message sent successfully",
                messageId: result.insertId
            });

        }
    );
});


// GET CONVERSATION

app.get("/messages/:user1/:user2", (req, res) => {

    const user1 = req.params.user1;
    const user2 = req.params.user2;

    const sql = `
        SELECT
            id,
            sender_id,
            receiver_id,
            message,
            created_at
        FROM messages
        WHERE
            (sender_id = ? AND receiver_id = ?)
            OR
            (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
    `;

    db.query(
        sql,
        [user1, user2, user2, user1],
        (err, result) => {

            if (err) {
                console.log(err);

                return res.status(500).json({
                    message: "Failed to fetch messages"
                });
            }

            res.status(200).json({
                messages: result
            });

        }
    );
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`server running on port ${PORT}`);
});